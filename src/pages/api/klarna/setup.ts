import type { NextApiRequest, NextApiResponse } from "next";
import { PrismaClient } from "@prisma/client";

import {
  clearKlarnaRefreshToken,
  hasKlarnaRefreshToken,
} from "@/lib/klarna-config";
import { klarnaSession } from "@/lib/session";

const prisma = new PrismaClient();

async function status() {
  const configured = hasKlarnaRefreshToken();
  let authOk = false;
  let authError: string | undefined;

  if (configured) {
    klarnaSession.revokeToken();
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
      return res.status(200).json(await status());
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
