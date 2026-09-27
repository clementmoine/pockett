import type { NextApiRequest, NextApiResponse } from "next";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

function extensionRoot(): string {
  return path.join(process.cwd(), "extensions", "pockett-connector");
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  const root = extensionRoot();
  if (!fs.existsSync(path.join(root, "manifest.json"))) {
    return res.status(404).json({ error: "Extension introuvable sur le serveur" });
  }

  const tmp = path.join(os.tmpdir(), `pockett-connector-${Date.now()}.zip`);
  try {
    await execFileAsync(
      "zip",
      [
        "-r",
        "-q",
        tmp,
        ".",
        "-x",
        "*.DS_Store",
        "*README.md",
        "*.key.pem",
        "*.key.pub.b64",
      ],
      { cwd: root },
    );
    const buf = fs.readFileSync(tmp);
    res.setHeader("Content-Type", "application/zip");
    res.setHeader(
      "Content-Disposition",
      'attachment; filename="pockett-connector.zip"',
    );
    res.setHeader("Cache-Control", "no-store");
    return res.status(200).send(buf);
  } catch (e) {
    console.error("[extension/zip]", e);
    return res.status(500).json({
      error:
        e instanceof Error
          ? e.message
          : "Impossible de construire le zip (zip CLI requis)",
    });
  } finally {
    try {
      fs.unlinkSync(tmp);
    } catch {
      /* ignore */
    }
  }
}
