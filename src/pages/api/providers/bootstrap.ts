import type { NextApiRequest, NextApiResponse } from "next";

import { getProviderBootstrapRunner } from "@/lib/provider-bootstrap";
import { getProviderCodeHandler } from "@/lib/provider-code";

/**
 * One-shot auth bootstrap for providers that need it.
 * POST { providerId, email, password, … } → { code, … }
 * Does not store credentials server-side.
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const providerId = String(req.body?.providerId ?? "").trim();
  if (!providerId) {
    return res.status(400).json({ error: "providerId requis" });
  }

  const meta = getProviderCodeHandler(providerId)?.bootstrap;
  if (!meta) {
    return res.status(400).json({ error: "Ce provider ne nécessite pas de login" });
  }

  const runner = getProviderBootstrapRunner(providerId);
  if (!runner) {
    return res.status(400).json({ error: "Bootstrap non configuré" });
  }

  for (const field of meta.fields) {
    const value = req.body?.[field.name];
    if (value == null || String(value).trim() === "") {
      return res.status(400).json({ error: `${field.label} requis` });
    }
  }

  try {
    const result = await runner({
      providerId,
      ...req.body,
    });
    return res.status(200).json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[providers/bootstrap]", message);
    return res.status(400).json({ error: message });
  }
}
