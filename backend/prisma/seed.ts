// prisma/seed.ts
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding database...");
  const dummyProfile = await prisma.userProfile.upsert({
    where: { supabaseUserId: "demo-supabase-user-001" },
    update: {},
    create: {
      supabaseUserId: "demo-supabase-user-001",
      email: "demo@partfinder.local",
      fullName: "Demo PartFinder User",
    },
  });
  console.log("Seeded demo profile:", dummyProfile);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
