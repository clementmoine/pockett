import type { NextApiRequest, NextApiResponse } from "next";

import { connectionAuth } from "@/lib/connection-enhance";

/**
 * Browser-connector login for a linked account.
 * The page starts PKCE; the extension posts the authorization code back.
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  const connectionId = String(
    req.method === "GET" ? req.query.connectionId : req.body?.connectionId ?? "",
  ).trim();
  const auth = connectionAuth(connectionId);
  if (!auth?.begin) {
    return res.status(400).json({ error: "Connexion navigateur non disponible" });
  }

  try {
    if (req.method === "GET") {
      return res.status(200).json(auth.poll(String(req.query.nonce ?? "")));
    }

    if (req.method !== "POST") {
      return res.status(405).json({ error: "Method not allowed" });
    }

    if (req.body?.action === "start") {
      const session = await auth.begin(
        req.body.country ? String(req.body.country) : undefined,
      );
      return res.status(200).json(session);
    }

    if (req.body?.action === "complete") {
      await auth.finish(String(req.body.nonce ?? ""), String(req.body.code ?? ""));
      return res.status(200).json({ status: "ready" });
    }

    return res.status(400).json({ error: "Action inconnue" });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[connections/bridge]", message);
    return res.status(400).json({ error: message });
  }
}
