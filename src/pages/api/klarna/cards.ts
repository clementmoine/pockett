import { NextApiRequest, NextApiResponse } from "next";

import { retry } from "@/lib/retry";
import { toBase64 } from "@/lib/toBase64";
import { KLARNA_PATHS } from "@/lib/klarna-providers-db";
import { klarnaSession } from "@/lib/session";

import type { Card } from "@prisma/client";

let cachedResponse: Omit<Card, "updatedAt" | "createdAt">[] | null = null;
let cachedAt: number | null = null;

const CACHE_TTL = 1000 * 60 * 30; // 30 minutes

/** Current Klarna loyalty BFF. */
export const LOYALTY_CONTENT_PATH = KLARNA_PATHS.loyaltyContent;

type LoyaltyIdentifier = {
  is_custom_card: boolean;
  loyalty_card_id?: string;
  processed: {
    provider_id?: string;
    name: string;
    label?: string;
    visual: { logo_url?: string; color: string };
    barcode: {
      format: string;
      content: string | number;
    };
  };
};

export default async function cards(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") return res.status(405).end("Method Not Allowed");

  try {
    if (cachedResponse && cachedAt && Date.now() - cachedAt < CACHE_TTL) {
      return res.status(200).json(cachedResponse);
    }

    const data = await klarnaSession.request<{
      loyalty_identifiers: LoyaltyIdentifier[];
    }>(LOYALTY_CONTENT_PATH);

    const identifiers = data.loyalty_identifiers || [];
    const cards: Omit<Card, "updatedAt" | "createdAt">[] = [];

    await Promise.all(
      identifiers.map(async (identifier) => {
        const processed = identifier.processed;
        if (!processed?.barcode?.content) return;

        let logo = "";
        const logoUrl = processed.visual?.logo_url;
        if (!identifier.is_custom_card && logoUrl) {
          try {
            logo = await retry(() => toBase64(logoUrl));
          } catch {
            logo = logoUrl;
          }
        }

        cards.push({
          id: "-1",
          providerId: processed.provider_id || null,
          type: processed.barcode.format === "QR_CODE" ? "qr" : "barcode",
          name: processed.name,
          code: String(processed.barcode.content),
          logo,
          color: processed.visual?.color || "#000000",
          country: null,
          tag: processed.label || null,
        });
      }),
    );

    cachedResponse = cards;
    cachedAt = Date.now();
    res.status(200).json(cards);
  } catch (error) {
    res.status(500).json({
      error: `Failed to fetch the wallet: ${
        error instanceof Error ? error.message : String(error)
      }`,
    });
  }
}
