import fs from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";

import { GRAND_FRAIS_PROVIDER_ID } from "@/lib/custom-provider-ids";

export {
  CUSTOM_PROVIDER_PREFIX,
  GRAND_FRAIS_PROVIDER_ID,
  isCustomProviderId,
} from "@/lib/custom-provider-ids";

/**
 * Providers hors catalogue Klarna (enseignes maison).
 * Id stable : `custom:<slug>`.
 */

export type CustomProviderDef = {
  id: string;
  name: string;
  color: string;
  /** Absolute or project-relative path to SVG/PNG to embed as data URL */
  logoPath: string;
  searchTerms: string[];
  markets: string[];
  defaultBarcodeFormat: "QR_CODE";
};

export const CUSTOM_PROVIDERS: CustomProviderDef[] = [
  {
    id: GRAND_FRAIS_PROVIDER_ID,
    name: "Grand Frais",
    // Lime from official SVG fill (#bdd642); red accent #ed2d2f
    color: "#bdd642",
    logoPath: "public/providers/grand-frais.svg",
    searchTerms: ["grand frais", "grandfrais", "gf"],
    markets: ["FR", "BE", "LU"],
    defaultBarcodeFormat: "QR_CODE",
  },
];

function resolveLogoFile(logoPath: string): string {
  if (path.isAbsolute(logoPath)) return logoPath;
  return path.join(process.cwd(), logoPath);
}

export function logoFileToDataUrl(logoPath: string): string | null {
  try {
    const file = resolveLogoFile(logoPath);
    const buf = fs.readFileSync(file);
    const ext = path.extname(file).toLowerCase();
    const mime =
      ext === ".svg"
        ? "image/svg+xml"
        : ext === ".jpg" || ext === ".jpeg"
          ? "image/jpeg"
          : ext === ".webp"
            ? "image/webp"
            : "image/png";
    return `data:${mime};base64,${buf.toString("base64")}`;
  } catch (err) {
    console.warn("[custom-providers] logo missing:", logoPath, err);
    return null;
  }
}

export async function seedCustomProviders(
  prisma?: PrismaClient,
): Promise<number> {
  const owned = !prisma;
  const client = prisma ?? new PrismaClient();
  let n = 0;
  try {
    for (const def of CUSTOM_PROVIDERS) {
      const logoUrl = logoFileToDataUrl(def.logoPath);
      const visual = {
        logoUrl,
        color: def.color,
      };
      const fields = {
        name: def.name,
        markets: JSON.stringify(def.markets),
        inputType: "MANUAL" as const,
        expectedManualInputCharacterSet: "NO_RESTRICTIONS" as const,
        searchTerms: JSON.stringify(def.searchTerms),
        defaultBarcodeFormat: def.defaultBarcodeFormat,
      };
      await client.provider.upsert({
        where: { id: def.id },
        update: {
          ...fields,
          updatedAt: new Date(),
          visual: { upsert: { create: visual, update: visual } },
        },
        create: {
          id: def.id,
          ...fields,
          visual: { create: visual },
        },
      });
      n++;
    }
    return n;
  } finally {
    if (owned) await client.$disconnect();
  }
}
