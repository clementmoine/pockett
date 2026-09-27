import { PrismaClient } from "@prisma/client";
import { seedCustomProviders } from "../src/lib/custom-providers";

async function main() {
  const prisma = new PrismaClient();
  try {
    const n = await seedCustomProviders(prisma);
    const row = await prisma.provider.findUnique({
      where: { id: "custom:grand-frais" },
      include: { visual: true },
    });
    console.log("seeded", n, row?.name, row?.visual?.color);
    console.log("logo", (row?.visual?.logoUrl || "").slice(0, 48));
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
