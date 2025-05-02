import path from "path";
import fs from "fs/promises";
import { NextApiRequest, NextApiResponse } from "next";
import { getAccessToken, retry } from "@/pages/api/klarna";

import type { Provider } from "@/types/provider";
import type { Country } from "@/types/country";

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

// Helpers pour lire/écrire la métadonnée globale
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

// Gestion d'un fournisseur individuel
async function getProviderFilePath(providerId: string): Promise<string> {
  await fs.mkdir(PROVIDERS_DIR, { recursive: true });
  return path.join(PROVIDERS_DIR, `${providerId}.json`);
}

async function saveProviderData(provider: Provider): Promise<Provider> {
  // Télécharger et convertir le logo en base64 si présent
  if (provider.visual.logo_url) {
    const originalLogoUrl = provider.visual.logo_url;

    try {
      const response = await retry(() => fetch(originalLogoUrl));
      if (response.ok) {
        const buffer = Buffer.from(await response.arrayBuffer());

        // Détecter le type MIME de l'image (simplifié)
        let mimeType = "image/png";
        if (
          originalLogoUrl.toLowerCase().endsWith(".jpg") ||
          originalLogoUrl.toLowerCase().endsWith(".jpeg")
        ) {
          mimeType = "image/jpeg";
        } else if (originalLogoUrl.toLowerCase().endsWith(".svg")) {
          mimeType = "image/svg+xml";
        }

        // Convertir en base64 et créer l'URL data
        const base64Data = buffer.toString("base64");
        const dataUrl = `data:${mimeType};base64,${base64Data}`;

        // Remplacer l'URL du logo par la chaîne base64
        provider.visual.logo_url = dataUrl;
      }
    } catch (err) {
      console.error(
        `Failed to download and convert logo for ${provider.provider_id}`,
        err,
      );
    }
  }

  // Sauvegarder les données du fournisseur avec le logo en base64
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
  // Get providers from Klarna API
  const accessToken = await retry(() => getAccessToken());
  if (!accessToken) throw new Error("Failed to get access token");

  const response = await retry(() =>
    fetch(
      "https://app.klarna.com/fr/api/consumer_wallet_bff/v1/all-providers",
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      },
    ),
  );

  if (!response.ok) {
    throw new Error(`Failed to fetch providers (${response.statusText})`);
  }

  const data = await response.json();
  if (!data?.providers || !Array.isArray(data.providers)) {
    throw new Error("Invalid response format from Klarna API");
  }

  const providers = data.providers as Provider[];

  // Traiter et sauvegarder chaque fournisseur en parallèle
  const processedProviders = await Promise.all(
    providers.map(async (provider) => {
      return await saveProviderData(provider);
    }),
  );

  // Mettre à jour les métadonnées
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

// Charger les fournisseurs depuis le cache
async function loadProviders(
  metadata: CacheMetadata,
  country?: Country,
): Promise<Provider[]> {
  // Filtrer les métadonnées si un pays est spécifié
  const providerIds = metadata.providers.map((p) => p.providerId);

  // Charger tous les fournisseurs en parallèle
  const providers = await Promise.all(
    providerIds.map(async (id) => {
      return await readProviderData(id);
    }),
  );

  // Filtrer les nulls et appliquer le filtre par pays si nécessaire
  const validProviders = providers.filter(
    (p): p is Provider =>
      p !== null && (!country || p.markets.includes(country)),
  );

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
    // Lire les métadonnées
    const metadata = await readMetadata();
    const isExpired =
      !metadata || Date.now() - metadata.lastFetched >= CACHE_TTL;

    let providers: Provider[];

    // Récupérer de nouvelles données si le cache est expiré
    if (isExpired) {
      providers = await fetchAndSaveProviders();
    } else {
      // Sinon, charger depuis le cache
      const country = req.query.country as Country | undefined;
      providers = await loadProviders(metadata, country);
    }

    // Appliquer le filtre par pays si ce n'est pas déjà fait
    if (req.query.country && !isExpired) {
      const country = req.query.country as Country;
      providers = providers.filter((p) => p.markets.includes(country));
    }

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
