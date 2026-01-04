import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("🔧 Starting database repair...");

  // 1. Fix Providers
  const providers = await prisma.provider.findMany();
  let fixedCount = 0;

  for (const provider of providers) {
    let needsUpdate = false;
    let newMarkets = provider.markets;
    let newSearchTerms = provider.searchTerms;

    // Check markets
    try {
      JSON.parse(provider.markets);
    } catch (e) {
      console.warn(
        `⚠️ Invalid JSON in markets for provider ${provider.name} (${provider.id}). Resetting to [].`,
      );
      newMarkets = "[]";
      needsUpdate = true;
    }

    // Check searchTerms
    try {
      JSON.parse(provider.searchTerms);
    } catch (e) {
      console.warn(
        `⚠️ Invalid JSON in searchTerms for provider ${provider.name} (${provider.id}). Resetting to [].`,
      );
      newSearchTerms = "[]";
      needsUpdate = true;
    }

    if (needsUpdate) {
      await prisma.provider.update({
        where: { id: provider.id },
        data: {
          markets: newMarkets,
          searchTerms: newSearchTerms,
        },
      });
      fixedCount++;
    }
  }

  console.log(`✅ Repair complete. Fixed ${fixedCount} providers.`);
}

main()
  .catch((e) => {
    console.error("❌ Repair failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
