import path from "path";
import fs from "fs/promises";
import { NextApiRequest, NextApiResponse } from "next";

import { retry } from "@/lib/retry";
import { klarnaSession } from "@/lib/session";

import type { Country } from "@/types/country";
import type { Provider } from "@/types/provider";

const CACHE_TTL = 1000 * 60 * 60 * 24 * 30; // 30 days
const BASE_DIR = path.join(process.cwd(), ".next", "cache", "data", "klarna");
const PROVIDERS_DIR = path.join(BASE_DIR, "providers");
const METADATA_FILE = path.join(BASE_DIR, "metadata.json");

interface ProviderMetadata {
  providerId: string;
  lastUpdated: number;
  hasLogo: boolean;
}

interface CacheMetadata {
  lastFetched: number;
  providers: ProviderMetadata[];
}

async function readMetadata(): Promise<CacheMetadata | null> {
  try {
    const content = await fs.readFile(METADATA_FILE, "utf-8");
    return JSON.parse(content) as CacheMetadata;
  } catch {
    return null;
  }
}

async function writeMetadata(metadata: CacheMetadata): Promise<void> {
  try {
    await fs.mkdir(BASE_DIR, { recursive: true });
    await fs.writeFile(METADATA_FILE, JSON.stringify(metadata), "utf-8");
  } catch (err) {
    console.error("Failed to write metadata file", err);
  }
}

// Get the JSON path to the provider in cache
async function getProviderFilePath(providerId: string): Promise<string> {
  await fs.mkdir(PROVIDERS_DIR, { recursive: true });
  return path.join(PROVIDERS_DIR, `${providerId}.json`);
}

async function saveProviderData(provider: Provider): Promise<Provider> {
  // Download and convert logo
  if (provider.visual.logo_url) {
    const originalLogoUrl = provider.visual.logo_url;

    try {
      const response = await retry(() => fetch(originalLogoUrl));

      if (response.ok) {
        const buffer = Buffer.from(await response.arrayBuffer());

        let mimeType = "image/png";
        if (
          originalLogoUrl.toLowerCase().endsWith(".jpg") ||
          originalLogoUrl.toLowerCase().endsWith(".jpeg")
        ) {
          mimeType = "image/jpeg";
        } else if (originalLogoUrl.toLowerCase().endsWith(".svg")) {
          mimeType = "image/svg+xml";
        }

        const base64Data = buffer.toString("base64");
        const dataUrl = `data:${mimeType};base64,${base64Data}`;

        // Save the logo url as base64
        provider.visual.logo_url = dataUrl;
      }
    } catch (err) {
      console.error(
        `Failed to download and convert logo for ${provider.provider_id}`,
        err,
      );
    }
  }

  // Save the providers data with logo in base64
  const filePath = await getProviderFilePath(provider.provider_id);
  await fs.writeFile(filePath, JSON.stringify(provider), "utf-8");

  return provider;
}

async function readProviderData(providerId: string): Promise<Provider | null> {
  try {
    const filePath = await getProviderFilePath(providerId);
    const content = await fs.readFile(filePath, "utf-8");
    return JSON.parse(content) as Provider;
  } catch {
    return null;
  }
}

// Fetch, process and save providers
async function fetchAndSaveProviders(): Promise<Provider[]> {
  const data = await klarnaSession.request<{ providers: Provider[] }>(
    "/fr/api/consumer_wallet_bff/v1/all-providers",
  );

  if (!data?.providers || !Array.isArray(data.providers)) {
    throw new Error("Invalid response format from Klarna API");
  }

  const providers = data.providers as Provider[];

  // Process each provider in parallel
  const processedProviders = await Promise.all(
    providers.map(async (provider) => {
      return await saveProviderData(provider);
    }),
  );

  // Update metadata
  const metadata: CacheMetadata = {
    lastFetched: Date.now(),
    providers: processedProviders.map((p) => ({
      providerId: p.provider_id,
      lastUpdated: Date.now(),
      hasLogo: !!p.visual.logo_url,
    })),
  };
  await writeMetadata(metadata);

  return processedProviders;
}

// Load providers from cache
async function loadProviders(metadata: CacheMetadata): Promise<Provider[]> {
  // Load providers ids
  const providerIds = metadata.providers.map((p) => p.providerId);

  // Load each provider in parallel
  const providers = await Promise.all(
    providerIds.map(async (id) => {
      return await readProviderData(id);
    }),
  );

  // Filter invalid
  const validProviders = providers.filter((p): p is Provider => p !== null);

  return validProviders;
}

export default async function handlers(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== "GET") {
    return res.status(405).end("Method Not Allowed");
  }

  try {
    const metadata = await readMetadata();
    const ignoreCache = req.query?.ignoreCache === "true";
    const isExpired =
      !metadata ||
      ignoreCache ||
      Date.now() - metadata.lastFetched >= CACHE_TTL;

    let providers: Provider[];
    const country = req.query.country as Country | undefined;
    if (!country) {
      return res.status(400).json({ error: "Missing 'country' query param" });
    }

    // Expired cache data
    if (isExpired) {
      providers = await fetchAndSaveProviders();
    } else {
      // Load from cache
      providers = await loadProviders(metadata);
    }

    providers = providers.filter((p) => p.markets.includes(country));

    return res.status(200).json(providers);
  } catch (error) {
    console.error("API error:", error);
    res.status(500).json({
      error: `Failed to fetch providers: ${
        error instanceof Error ? error.message : String(error)
      }`,
    });
  }
}
