import { NextApiRequest, NextApiResponse } from "next";

import { RawProvider } from "@/types/provider";

import { retry } from "@/lib/retry";
import { toBase64 } from "@/lib/toBase64";
import { klarnaSession } from "@/lib/session";

import type { Card } from "@prisma/client";

let cachedResponse: Omit<Card, "updatedAt" | "createdAt">[] | null = null;
let cachedAt: number | null = null;

const CACHE_TTL = 1000 * 60 * 30; // 30 minutes

export default async function cards(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") return res.status(405).end("Method Not Allowed");

  try {
    if (cachedResponse && cachedAt && Date.now() - cachedAt < CACHE_TTL) {
      return res.status(200).json(cachedResponse);
    }

    const data = await klarnaSession.request<{
      loyalty_identifiers: [
        {
          is_custom_card: boolean;
          processed: {
            provider_id: RawProvider["provider_id"];
            name: RawProvider["provider_name"];
            label: string;
            visual: RawProvider["visual"];
            barcode: {
              format: RawProvider["default_barcode_format"];
              content: string | number;
            };
          };
        },
      ];
    }>("/fr/api/consumer_wallet_bff/v1/loyalty-content");

    const identifiers = data.loyalty_identifiers;

    const cards: Omit<Card, "updatedAt" | "createdAt">[] = [];

    await Promise.all(
      identifiers.map(async (identifier) => {
        let name = identifier.processed.name;
        if (identifier.processed.label) {
          name = `${identifier.processed.name} (${identifier.processed.label.trim()})`;
        }

        let logo = "";
        const logoUrl = identifier.processed.visual.logo_url;
        if (!identifier.is_custom_card && logoUrl) {
          logo = await retry(() => toBase64(logoUrl));
        }

        cards.push({
          id: "-1",
          providerId: identifier.processed.provider_id,
          type:
            identifier.processed.barcode.format === "QR_CODE"
              ? "qr"
              : "barcode",
          name: name,
          code: identifier.processed.barcode.content.toString(),
          logo: logo,
          color: identifier.processed.visual.color,
          country: null,
        });
      }),
    );

    cachedResponse = cards;
    cachedAt = Date.now();

    res.status(200).json(cards);
  } catch (error) {
    res.status(500).json({ error: `Failed to fetch the wallet, ${error}` });
  }
}
