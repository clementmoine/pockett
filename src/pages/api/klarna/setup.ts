import type { NextApiRequest, NextApiResponse } from "next";
import { PrismaClient } from "@prisma/client";

import {
  clearKlarnaRefreshToken,
  hasKlarnaRefreshToken,
} from "@/lib/klarna-config";
import { klarnaSession } from "@/lib/session";

const prisma = new PrismaClient();

async function status(soft = false) {
  const configured = hasKlarnaRefreshToken();
  let authOk = false;
  let authError: string | undefined;

  if (configured && soft) {
    // Waiting poll after connect: file presence is enough — ingest already
    // validated the grant. Avoid extra refresh_token calls.
    authOk = true;
  } else if (configured) {
    // Do not revoke first: that forced a Klarna refresh on every status poll
    // (modal open, waiting interval) and burned / revoked the refresh token.
    const result = await klarnaSession.ensureReady();
    authOk = result.ok;
    if (!result.ok) authError = result.error;
  }

  return {
    configured,
    authOk,
    authError,
    providerCount: await prisma.provider.count(),
    needsSetup: !configured || !authOk,
  };
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  try {
    if (req.method === "GET") {
      const soft =
        req.query.soft === "1" ||
        req.query.soft === "true" ||
        req.query.soft === "yes";
      return res.status(200).json(await status(soft));
    }

    if (
      req.method === "POST" &&
      (req.body as { action?: string })?.action === "disconnect"
    ) {
      clearKlarnaRefreshToken();
      klarnaSession.revokeToken();
      return res.status(200).json({ ok: true, ...(await status()) });
    }

    return res.status(405).end("Method Not Allowed");
  } catch (e) {
    console.error("[klarna/setup]", e);
    return res.status(500).json({
      error: e instanceof Error ? e.message : String(e),
    });
  } finally {
    await prisma.$disconnect();
  }
}
