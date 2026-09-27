import type { NextApiRequest, NextApiResponse } from "next";
import { PrismaClient } from "@prisma/client";

import { getProviderRemoteCodeRunner } from "@/lib/provider-bootstrap";
import { getProviderCodeHandler } from "@/lib/provider-code";

const prisma = new PrismaClient();

/**
 * Fresh scannable payload for a card.
 * - `remoteCode` → provider BFF / network
 * - `liveCode` → offline local generation
 * - else → stored code
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const id = typeof req.query.id === "string" ? req.query.id : null;
  if (!id) return res.status(400).json({ error: "id requis" });

  try {
    const card = await prisma.card.findUnique({ where: { id } });
    if (!card) return res.status(404).json({ error: "Carte introuvable" });

    const handler = getProviderCodeHandler(card.providerId);

    if (handler?.remoteCode) {
      const runner = getProviderRemoteCodeRunner(card.providerId);
      if (!runner) {
        return res.status(400).json({ error: "Refresh distant non configuré" });
      }
      const result = await runner(card.code);
      if (result.credential && result.credential !== card.code) {
        await prisma.card.update({
          where: { id: card.id },
          data: { code: result.credential },
        });
      }
      return res.status(200).json({
        id: card.id,
        code: result.code,
        dynamic: true,
        offline: false,
        caption:
          result.caption ??
          handler.caption?.(card.code, result.code) ??
          null,
      });
    }

    if (handler?.liveCode) {
      const code = handler.liveCode(card.code);
      if (!code) {
        return res.status(400).json({
          error: "Identifiant invalide — ré-enregistre la carte",
        });
      }
      return res.status(200).json({
        id: card.id,
        code,
        dynamic: true,
        offline: true,
        caption: handler.caption?.(card.code, code) ?? null,
      });
    }

    return res.status(200).json({
      id: card.id,
      code: card.code,
      dynamic: false,
    });
  } catch (error) {
    console.error("[cards/code]", error);
    return res.status(500).json({
      error: error instanceof Error ? error.message : String(error),
    });
  } finally {
    await prisma.$disconnect();
  }
}
