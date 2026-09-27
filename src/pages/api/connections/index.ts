import type { NextApiRequest, NextApiResponse } from "next";

import { connectionAuth, enhancedProviderIds } from "@/lib/connection-enhance";
import { CONNECTION_SERVICES } from "@/lib/connections";

/**
 * Linked-account status. `providerIds` are catalog cards that currently
 * run an on-show upgrade (empty when the account is not linked).
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method === "GET") {
    const services = CONNECTION_SERVICES.map((service) => {
      const auth = connectionAuth(service.id);
      const linked =
        typeof auth?.linked === "function" ? Boolean(auth.linked()) : false;
      return { id: service.id, linked };
    });
    return res.status(200).json({
      services,
      providerIds: enhancedProviderIds(),
    });
  }

  if (req.method === "POST" && req.body?.action === "disconnect") {
    const id = String(req.body.id ?? "");
    const auth = connectionAuth(id);
    if (!auth) return res.status(400).json({ error: "Service inconnu" });
    auth.disconnect();
    return res.status(200).json({ linked: false });
  }

  return res.status(405).json({ error: "Method not allowed" });
}
