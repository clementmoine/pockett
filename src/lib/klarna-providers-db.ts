import { PrismaClient } from "@prisma/client";

import { retry } from "@/lib/retry";
import { klarnaSession } from "@/lib/session";

import type { RawProvider, ProviderWithVisual } from "@/types/provider";

const prisma = new PrismaClient();

/** Klarna loyalty BFF paths (auth required). */
export const KLARNA_PATHS = {
  providerList: "/fr/api/loyalty_cards_bff/v1/provider-list",
  loyaltyContent: "/fr/api/loyalty_cards_bff/v1/loyalty-content",
} as const;

async function fetchProviderList(market: string): Promise<RawProvider[]> {
  const data = await klarnaSession.request<{ providers: RawProvider[] }>(
    KLARNA_PATHS.providerList,
    {},
    "EU",
    market,
  );
  if (!data?.providers || !Array.isArray(data.providers)) {
    throw new Error("Invalid provider-list response from Klarna");
  }
  return data.providers;
}

async function downloadAndConvertLogo(logoUrl: string): Promise<string | null> {
  try {
    const response = await retry(() => fetch(logoUrl));
    if (!response.ok) return null;
    const buffer = Buffer.from(await response.arrayBuffer());
    const header = (response.headers.get("content-type") || "")
      .split(";")[0]
      .trim()
      .toLowerCase();
    const mimeType = header.startsWith("image/") ? header : "image/png";
    return `data:${mimeType};base64,${buffer.toString("base64")}`;
  } catch (err) {
    console.error(`Failed to download logo ${logoUrl}`, err);
    return null;
  }
}

async function saveProvider(raw: RawProvider, embedLogos: boolean): Promise<void> {
  let logoUrl = raw.visual?.logo_url || null;
  if (embedLogos && logoUrl) {
    logoUrl = (await downloadAndConvertLogo(logoUrl)) || logoUrl;
  }
  const visual = {
    logoUrl,
    color: raw.visual?.color || "#000000",
  };
  const fields = {
    name: raw.provider_name,
    markets: JSON.stringify(raw.markets),
    inputType: raw.input_type,
    expectedManualInputCharacterSet: raw.expected_manual_input_character_set,
    searchTerms: JSON.stringify(raw.search_terms || []),
    defaultBarcodeFormat: raw.default_barcode_format,
  };

  await prisma.provider.upsert({
    where: { id: raw.provider_id },
    update: {
      ...fields,
      updatedAt: new Date(),
      visual: { upsert: { create: visual, update: visual } },
    },
    create: {
      id: raw.provider_id,
      ...fields,
      visual: { create: visual },
    },
  });
}

export async function loadProviders(): Promise<ProviderWithVisual[]> {
  const providers = await prisma.provider.findMany({
    include: { visual: true },
    orderBy: { name: "asc" },
  });
  return providers.map((p) => ({
    ...p,
    visual: {
      logoUrl: p.visual?.logoUrl || null,
      color: p.visual?.color || "#000000",
    },
  }));
}

/** Klarna often ships provider: + loyalty-program: for the same brand. */
export function dedupeProvidersByName(
  providers: ProviderWithVisual[],
  market?: string,
): ProviderWithVisual[] {
  const score = (p: ProviderWithVisual) => {
    let s = p.id.includes(":loyalty-program:")
      ? 100
      : p.id.includes(":provider:")
        ? 50
        : 0;
    try {
      const markets = JSON.parse(p.markets) as string[];
      if (market && markets.includes(market)) s += 20;
      s += Math.max(0, 30 - markets.length);
    } catch {
      /* ignore */
    }
    if (p.visual?.logoUrl) s += 1;
    return s;
  };

  const best = new Map<string, ProviderWithVisual>();
  for (const p of providers) {
    const key = p.name
      .trim()
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");
    if (!key) continue;
    const prev = best.get(key);
    if (!prev || score(p) > score(prev)) best.set(key, p);
  }
  return [...best.values()].sort((a, b) => a.name.localeCompare(b.name, "fr"));
}

export async function fetchAndSaveProviders(options?: {
  market?: string;
  embedLogos?: boolean;
}): Promise<ProviderWithVisual[]> {
  const market = options?.market || "FR";
  const embedLogos = options?.embedLogos ?? true;
  const byId = new Map<string, RawProvider>();
  for (const p of await fetchProviderList(market)) {
    if (p?.provider_id) byId.set(p.provider_id, p);
  }
  for (const p of byId.values()) {
    await saveProvider(p, embedLogos);
  }
  return loadProviders();
}

export async function disconnectProvidersDb(): Promise<void> {
  await prisma.$disconnect();
}
