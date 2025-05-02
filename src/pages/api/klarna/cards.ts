import { NextApiRequest, NextApiResponse } from "next";

import { getAccessToken, retry, toBase64 } from "@/pages/api/klarna";

import type { Card } from "@/types/card";

let cachedResponse: Card[] | null = null;
let cachedAt: number | null = null;

const CACHE_TTL = 1000 * 60 * 30; // 30 minutes

export default async function cards(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") return res.status(405).end("Method Not Allowed");

  try {
    if (cachedResponse && cachedAt && Date.now() - cachedAt < CACHE_TTL) {
      return res.status(200).json(cachedResponse);
    }

    const accessToken = await retry(() => getAccessToken());

    if (!accessToken) {
      throw new Error("Access token is missing");
    }

    const response = await retry(() =>
      fetch(
        "https://app.klarna.com/fr/api/consumer_wallet_bff/v1/loyalty-content",
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        },
      ),
    );

    if (!response.ok) {
      throw new Error("Failed to fetch loyalty content");
    }

    const identifiers = (await response.json()).loyalty_identifiers;

    const cards: Card[] = [];

    await Promise.all(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      identifiers.map(async (identifier: any) => {
        let name = identifier.processed.name;
        if (identifier.processed.label) {
          name = `${identifier.processed.name} (${identifier.processed.label.trim()})`;
        }

        let logo = "";
        if (
          !identifier.is_custom_card &&
          identifier.processed.visual.logo_url
        ) {
          logo = await toBase64(identifier.processed.visual.logo_url);
        }

        cards.push({
          id: -1,
          provider: identifier.processed.provider_id,
          type:
            identifier.processed.barcode.format === "QR_CODE"
              ? "qr"
              : "barcode",
          name: name,
          code: identifier.processed.barcode.content,
          logo: logo,
          color: identifier.processed.visual.color,
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
