import type { NextApiRequest, NextApiResponse } from "next";
import color from "color";
import sharp from "sharp";
import { dataUriToBuffer } from "data-uri-to-buffer";
import { Card } from "@/lib/types";

export const config = {
  api: {
    bodyParser: {
      sizeLimit: "10mb",
    },
  },
};

function formatColorToRgba(inputColor: string): string {
  try {
    return color(inputColor.toLowerCase()).hex();
  } catch (error) {
    console.error(`Invalid color format: ${inputColor}`, error);
    return "#FFF";
  }
}

async function processAndUploadLogo(dataUri: string): Promise<string> {
  const apiKey = process.env.ADDTOWALLET_API_KEY;

  if (!apiKey) {
    throw new Error("ADDTOWALLET_API_KEY is missing in environment variables");
  }

  const { buffer } = dataUriToBuffer(dataUri);

  // Resize and convert the image to PNG (150x150px)
  const pngBuffer = await sharp(buffer)
    .resize({
      width: 150,
      height: 150,
      fit: "contain",
      background: { r: 255, g: 255, b: 255, alpha: 0 },
    })
    .png()
    .toBuffer();

  // Create a FormData object for the multipart/form-data request
  const formData = new FormData();
  formData.append(
    "file",
    new File([pngBuffer], "logo.png", { type: "image/png" }),
  );

  const uploadUrl =
    "https://app.addtowallet.co/api/card/upload?path=/&type=logoUrl";

  const response = await fetch(uploadUrl, {
    method: "POST",
    headers: {
      accesstoken: apiKey,
    },
    body: formData,
  });

  if (!response.ok) {
    throw new Error(
      `Failed to upload logo to AddToWallet (${response.statusText})`,
    );
  }

  const { data } = (await response.json()) as { data: { url: string } };

  return data.url; // Return the hosted image URL
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== "POST") return res.status(405).end("Method Not Allowed");

  const { platform = process.env.TARGET || "apple", ...card } =
    req.body as Card & {
      platform: "google" | "apple";
    };

  try {
    const apiKey = process.env.ADDTOWALLET_API_KEY;

    const baseUrl = "https://app.addtowallet.co/";

    if (!apiKey) {
      return res.status(500).json({
        error: "ADDTOWALLET_API_KEY is missing in environment variables",
      });
    }

    // Process and upload the logo if provided
    let logoUrl: string | null = null;
    if (card.logo) {
      logoUrl = await processAndUploadLogo(card.logo);
    }

    // Code to be used for the barcode
    const parsedCode = card.code.replace(/[^a-zA-Z0-9]/g, "");
    const type =
      (card.type === "auto" && parsedCode.length > 26) || card.type == "qr"
        ? "QR_CODE"
        : "CODE_128";

    // Format the color to RGBA
    const formattedColor = formatColorToRgba(card.color);

    // Set the text color based on the color
    const textColor = color(card.color).isLight() ? "#000000" : "#FFFFFF";

    // Call the Create Card API using fetch
    const response = await fetch(`${baseUrl}api/card/create`, {
      method: "POST",
      headers: {
        apikey: apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        passType: "generic",
        genericType: "GENERIC_TYPE_UNSPECIFIED",
        logoUrl,
        cardTitle: card.name,
        header: card.name,
        textModulesData: [],
        linksModuleData: [],
        barcodeType: type,
        barcodeValue: parsedCode,
        barcodeAltText: parsedCode,
        hexBackgroundColor: formattedColor,
        appleFontColor: textColor,
        changedAppleFontColor: false,
        stateType: "ACTIVE",
        subheader: "",
        herorawurl: null,
        heroImage: null,
        notificationHeading: null,
      }),
    });

    if (!response.ok) {
      console.error("Error creating card:", response);
      throw new Error(`Failed to create card: ${response.statusText}`);
    }

    const { cardId } = (await response.json()) as { cardId: string };

    const previewRes = await fetch(`${baseUrl}api/preview/${cardId}`, {
      headers: {
        apikey: apiKey,
      },
    });

    if (!previewRes.ok) {
      throw new Error(`Failed to fetch preview data: ${previewRes.statusText}`);
    }

    const previewData = await previewRes.json();
    const { applePassUrl, googlePassUrl } = previewData.data as {
      applePassUrl: string;
      googlePassUrl: string;
    };

    // Response with the card URL
    if (platform === "google") {
      res.status(200).json({ cardUrl: googlePassUrl });
    } else {
      res.status(200).json({ cardUrl: applePassUrl });
    }
  } catch (error) {
    res.status(500).json({ error: `Failed to generate pass, ${error}` });
  }
}
