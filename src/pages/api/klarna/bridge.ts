import type { NextApiRequest, NextApiResponse } from "next";
import { PrismaClient } from "@prisma/client";

import {
  consumeBridgeNonce,
  createBridgeSession,
  klarnaLoginUrl,
  persistKlarnaRefreshToken,
} from "@/lib/klarna-config";
import { fetchAndSaveProviders } from "@/lib/klarna-providers-db";
import { klarnaSession } from "@/lib/session";

const prisma = new PrismaClient();

function setCors(res: NextApiResponse) {
  res.setHeader("Access-Control-Allow-Origin", "https://app.klarna.com");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

async function ingest(token: string, nonce: string, market = "FR") {
  const t = token.trim();
  if (!t.includes("refresh")) {
    return { ok: false as const, status: 400, error: "Token Klarna invalide" };
  }
  if (!consumeBridgeNonce(nonce)) {
    return {
      ok: false as const,
      status: 403,
      error: "Session bridge expirée — relance Connect Klarna",
    };
  }

  persistKlarnaRefreshToken(t);
  klarnaSession.revokeToken();
  const ready = await klarnaSession.ensureReady();
  if (!ready.ok) {
    return {
      ok: false as const,
      status: 400,
      error: `Refresh Klarna échoué: ${ready.error}`,
    };
  }

  await fetchAndSaveProviders({ market });
  return {
    ok: true as const,
    providerCount: await prisma.provider.count(),
  };
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  setCors(res);
  if (req.method === "OPTIONS") return res.status(204).end();

  try {
    if (req.method === "POST" && req.body?.action === "start") {
      const session = createBridgeSession();
      return res.status(200).json({
        nonce: session.nonce,
        expiresAt: session.expiresAt,
        klarnaLoginUrl: klarnaLoginUrl(session.nonce),
      });
    }

    if (req.method === "POST" && req.body?.token) {
      const result = await ingest(
        String(req.body.token),
        String(req.body.nonce || ""),
        req.body.market || "FR",
      );
      if (!result.ok) {
        return res.status(result.status).json({ error: result.error });
      }
      return res.status(200).json(result);
    }

    return res.status(405).json({ error: "Method Not Allowed" });
  } catch (e) {
    console.error("[klarna/bridge]", e);
    return res.status(500).json({
      error: e instanceof Error ? e.message : String(e),
    });
  } finally {
    await prisma.$disconnect();
  }
}
