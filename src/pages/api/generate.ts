import type { NextApiRequest, NextApiResponse } from "next";
import path from "path";
import fs from "fs";
import { Template } from "@walletpass/pass-js";
import sharp from "sharp"; // Import sharp for image processing

export const config = {
  api: {
    bodyParser: {
      sizeLimit: "10mb", // Useful if you pass a logo in base64
    },
  },
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== "POST") return res.status(405).end("Method Not Allowed");

  const card = req.body as {
    name: string;
    id: number;
    code: string;
    logo: string | null;
    theme: string;
  };

  try {
    // Load the template
    const templatePath = path.join(process.cwd(), "pass-template");
    const template = await Template.load(
      templatePath,
      "your-certificate-password",
    );

    // Load the certificate and private key
    const certPath = path.join(process.cwd(), "certs", "wwdr.pem");
    const keyPath = path.join(process.cwd(), "certs", "key.pem");

    if (!fs.existsSync(certPath) || !fs.existsSync(keyPath)) {
      throw new Error("Certificate or private key file is missing.");
    }

    const cert = fs.readFileSync(certPath, "utf-8");
    const key = fs.readFileSync(keyPath, "utf-8");

    await template.setCertificate(cert);
    await template.setPrivateKey(key, "your-certificate-password"); // Replace with your actual password

    // Set template fields
    template.passTypeIdentifier = "pass.com.example.passbook";
    template.teamIdentifier = "YOUR_TEAM_ID"; // Replace with your actual team ID
    template.organizationName = "Your Organization";
    template.backgroundColor = card.theme;
    template.foregroundColor = "rgb(255, 255, 255)";
    template.labelColor = "rgb(0, 0, 0)";

    const iconPath = path.join(process.cwd(), "pass-assets", "icon.png");
    const logoPath = path.join(process.cwd(), "pass-assets", "logo.png");
    if (fs.existsSync(iconPath)) {
      await template.images.add("icon", iconPath);
    }
    if (fs.existsSync(logoPath)) {
      await template.images.add("logo", logoPath);
    }

    // Create a pass from the template
    const pass = template.createPass({
      serialNumber: card.id.toString(),
      description: "Personalized Card",
    });

    // Add fields to the pass
    pass.primaryFields.add({
      key: "name",
      label: "Name",
      value: card.name,
    });

    pass.secondaryFields.add({
      key: "code",
      label: "Code",
      value: card.code,
    });

    // Generate the pass as a buffer
    const buffer = await pass.asBuffer();

    // Send the pass to the client
    res.setHeader("Content-Type", "application/vnd.apple.pkpass");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=card-${card.id}.pkpass`,
    );
    res.send(buffer);
  } catch (error) {
    console.error("Error generating pass:", error);
    res.status(500).json({ error: "Failed to generate pass" });
  }
}
