import type { NextApiRequest, NextApiResponse } from "next";
import { PrismaClient } from "@prisma/client";

import { runProviderEnhancement } from "@/lib/connection-enhance";

const prisma = new PrismaClient();

/**
 * On-show upgrade for a catalog card (coupons, etc.).
 * Does not change the stored code. No-op when the account is not linked.
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const id = typeof req.query.id === "string" ? req.query.id : null;
  if (!id) return res.status(400).json({ error: "id requis" });

  try {
    const card = await prisma.card.findUnique({ where: { id } });
    if (!card) return res.status(404).json({ error: "Carte introuvable" });
    const result = await runProviderEnhancement(card.providerId);
    return res.status(200).json({ ok: true, note: result.note });
  } catch (error) {
    console.error("[cards/enhance]", error);
    return res.status(200).json({ ok: false });
  } finally {
    await prisma.$disconnect();
  }
}
