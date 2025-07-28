import { NextApiRequest, NextApiResponse } from "next";
import { PrismaClient } from "@prisma/client";

import { retry } from "@/lib/retry";
import { klarnaSession } from "@/lib/session";

import type { Country } from "@prisma/client";
import type { RawProvider, ProviderWithVisual } from "@/types/provider";

const prisma = new PrismaClient();
const CACHE_TTL = 1000 * 60 * 60 * 24 * 30; // 30 days

async function downloadAndConvertLogo(logoUrl: string): Promise<string | null> {
  try {
    const response = await retry(() => fetch(logoUrl));

    if (response.ok) {
      const buffer = Buffer.from(await response.arrayBuffer());

      let mimeType = "image/png";
      if (
        logoUrl.toLowerCase().endsWith(".jpg") ||
        logoUrl.toLowerCase().endsWith(".jpeg")
      ) {
        mimeType = "image/jpeg";
      } else if (logoUrl.toLowerCase().endsWith(".svg")) {
        mimeType = "image/svg+xml";
      }

      const base64Data = buffer.toString("base64");
      return `data:${mimeType};base64,${base64Data}`;
    }
  } catch (err) {
    console.error(`Failed to download and convert logo from ${logoUrl}`, err);
  }
  return null;
}

async function saveProvider(rawProvider: RawProvider): Promise<void> {
  // Download and convert logo if needed
  let logoUrl = rawProvider.visual.logo_url || null;
  if (logoUrl) {
    const base64Logo = await downloadAndConvertLogo(logoUrl);
    logoUrl = base64Logo || logoUrl; // Keep original if conversion fails
  }

  // Upsert provider with visual
  await prisma.provider.upsert({
    where: { id: rawProvider.provider_id },
    update: {
      name: rawProvider.provider_name,
      markets: JSON.stringify(rawProvider.markets),
      inputType: rawProvider.input_type,
      expectedManualInputCharacterSet:
        rawProvider.expected_manual_input_character_set,
      searchTerms: JSON.stringify(rawProvider.search_terms),
      defaultBarcodeFormat: rawProvider.default_barcode_format,
      updatedAt: new Date(),
      visual: {
        upsert: {
          create: {
            logoUrl,
            color: rawProvider.visual.color,
          },
          update: {
            logoUrl,
            color: rawProvider.visual.color,
          },
        },
      },
    },
    create: {
      id: rawProvider.provider_id,
      name: rawProvider.provider_name,
      markets: JSON.stringify(rawProvider.markets),
      inputType: rawProvider.input_type,
      expectedManualInputCharacterSet:
        rawProvider.expected_manual_input_character_set,
      searchTerms: JSON.stringify(rawProvider.search_terms),
      defaultBarcodeFormat: rawProvider.default_barcode_format,
      visual: {
        create: {
          logoUrl,
          color: rawProvider.visual.color,
        },
      },
    },
  });
}

async function fetchAndSaveProviders(): Promise<ProviderWithVisual[]> {
  const data = await klarnaSession.request<{ providers: RawProvider[] }>(
    "/fr/api/consumer_wallet_bff/v1/all-providers",
  );

  if (!data?.providers || !Array.isArray(data.providers)) {
    throw new Error("Invalid response format from Klarna API");
  }

  const providers = data.providers;

  // Process each provider in parallel
  await Promise.all(
    providers.map(async (provider) => {
      await saveProvider(provider);
    }),
  );

  // Return providers from database to ensure consistency
  return await loadProviders();
}

async function loadProviders(): Promise<ProviderWithVisual[]> {
  const providers = await prisma.provider.findMany({
    include: { visual: true },
    orderBy: { name: "asc" },
  });

  return providers.map((provider) => {
    const formattedPrivider: ProviderWithVisual = { ...provider };

    formattedPrivider.visual = {
      logoUrl: provider.visual?.logoUrl || null,
      color: provider.visual?.color || "#000000",
    };

    return formattedPrivider;
  });
}

async function isCacheExpired(): Promise<boolean> {
  try {
    // Check if we have any providers and when they were last updated
    const latestProvider = await prisma.provider.findFirst({
      orderBy: {
        updatedAt: "desc",
      },
      select: {
        updatedAt: true,
      },
    });

    if (!latestProvider) {
      return true; // No providers in DB, need to fetch
    }

    const timeSinceUpdate = Date.now() - latestProvider.updatedAt.getTime();
    return timeSinceUpdate >= CACHE_TTL;
  } catch (error) {
    console.error("Error checking cache expiration:", error);
    return true; // On error, assume cache is expired
  }
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== "GET") {
    return res.status(405).end("Method Not Allowed");
  }

  try {
    const country = req.query.country as Country | undefined;
    if (!country) {
      return res.status(400).json({ error: "Missing 'country' query param" });
    }

    const ignoreCache = req.query?.ignoreCache === "true";
    const isExpired = ignoreCache || (await isCacheExpired());

    let providers: ProviderWithVisual[];

    if (isExpired) {
      console.log(
        "Cache expired or ignored, fetching fresh data from Klarna API",
      );
      providers = await fetchAndSaveProviders();
    } else {
      console.log("Loading providers from database");
      providers = await loadProviders();
    }

    // Filter providers by country
    const filteredProviders = providers.filter((p) =>
      JSON.parse(p.markets).includes(country),
    );

    return res.status(200).json(filteredProviders);
  } catch (error) {
    console.error("API error:", error);
    res.status(500).json({
      error: `Failed to fetch providers: ${
        error instanceof Error ? error.message : String(error)
      }`,
    });
  } finally {
    await prisma.$disconnect();
  }
}
