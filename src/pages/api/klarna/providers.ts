import type { NextApiRequest, NextApiResponse } from "next";

import {
  dedupeProvidersByName,
  disconnectProvidersDb,
  fetchAndSaveProviders,
  loadProviders,
} from "@/lib/klarna-providers-db";

import type { Country } from "@prisma/client";
import type { ProviderWithVisual } from "@/types/provider";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== "GET") return res.status(405).end("Method Not Allowed");

  const country = req.query.country as Country | undefined;
  if (!country) {
    return res.status(400).json({ error: "Missing 'country' query param" });
  }

  try {
    const refresh =
      req.query.refresh === "1" || req.query.refresh === "true";

    let providers: ProviderWithVisual[];
    try {
      providers = await loadProviders();
      const needsSync =
        refresh ||
        providers.length === 0 ||
        providers.some((p) => p.visual?.logoUrl?.startsWith("http"));
      if (needsSync) {
        providers = await fetchAndSaveProviders({
          market: country,
          embedLogos: true,
        });
      }
    } catch (error) {
      console.log("Klarna live fetch failed, using DB cache", error);
      providers = await loadProviders();
    }

    const filtered = providers.filter((p) => {
      try {
        return JSON.parse(p.markets).includes(country);
      } catch {
        return false;
      }
    });

    return res.status(200).json(dedupeProvidersByName(filtered, country));
  } catch (error) {
    console.error("API error:", error);
    return res.status(500).json({
      error: `Failed to fetch providers: ${
        error instanceof Error ? error.message : String(error)
      }`,
    });
  } finally {
    await disconnectProvidersDb();
  }
}
