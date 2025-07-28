import { PrismaClient } from "@prisma/client";
import type {
  Provider,
  Country,
  CharacterSet,
  ProviderVisual,
} from "@prisma/client";

import fs from "fs";
import path from "path";

const prisma = new PrismaClient();
export interface RawProvider {
  provider_id: Provider["id"];
  provider_name: Provider["name"];
  markets: Country[];
  input_type: Provider["inputType"];
  expected_manual_input_character_set: CharacterSet;
  search_terms: string[];
  visual: {
    logo_url?: ProviderVisual["logoUrl"];
    color: ProviderVisual["color"];
  };
  default_barcode_format: Provider["defaultBarcodeFormat"];
}
async function main() {
  console.log("🌱 Seeding database...");

  // Lire le fichier providers.json
  const providersFilePath = path.join(process.cwd(), "prisma/providers.json");

  if (!fs.existsSync(providersFilePath)) {
    console.log("📭 Fichier providers.json absent, seed ignoré.");
    return;
  }

  try {
    const providersFileContent = fs.readFileSync(providersFilePath, "utf-8");
    const providersData: RawProvider[] = JSON.parse(providersFileContent);

    console.log(`📁 Found ${providersData.length} providers in providers.json`);

    // Seed chaque provider
    let seededCount = 0;
    let skippedCount = 0;

    for (const providerData of providersData) {
      try {
        await prisma.provider.upsert({
          where: { id: providerData.provider_id },
          update: {
            name: providerData.provider_name,
            markets: JSON.stringify(providerData.markets),
            inputType: providerData.input_type,
            expectedManualInputCharacterSet:
              providerData.expected_manual_input_character_set,
            searchTerms: JSON.stringify(providerData.search_terms),
            defaultBarcodeFormat: providerData.default_barcode_format,
            visual: {
              upsert: {
                create: {
                  logoUrl: providerData.visual.logo_url || null,
                  color: providerData.visual.color,
                },
                update: {
                  logoUrl: providerData.visual.logo_url || null,
                  color: providerData.visual.color,
                },
              },
            },
          },
          create: {
            id: providerData.provider_id,
            name: providerData.provider_name,
            markets: JSON.stringify(providerData.markets),
            inputType: providerData.input_type,
            expectedManualInputCharacterSet:
              providerData.expected_manual_input_character_set,
            searchTerms: JSON.stringify(providerData.search_terms),
            defaultBarcodeFormat: providerData.default_barcode_format,
            visual: {
              create: {
                logoUrl: providerData.visual.logo_url || null,
                color: providerData.visual.color,
              },
            },
          },
        });

        seededCount++;

        // Log progress every 10 providers
        if (seededCount % 10 === 0) {
          console.log(
            `✅ Seeded ${seededCount}/${providersData.length} providers...`,
          );
        }
      } catch (error) {
        console.error(
          `❌ Failed to seed provider ${providerData.provider_id}:`,
          error,
        );
        skippedCount++;
      }
    }

    console.log("✅ Providers seeded successfully!");
    console.log(`📊 Summary: ${seededCount} seeded, ${skippedCount} skipped`);
    console.log("🎉 Database seeded successfully!");
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      console.error("❌ providers.json file not found in project root");
      console.log(
        "💡 Make sure to place your providers.json file in the project root directory",
      );
    } else {
      console.error("❌ Failed to read or parse providers.json:", error);
    }
    throw error;
  }
}

main()
  .catch((e) => {
    console.error("❌ Error seeding database:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
