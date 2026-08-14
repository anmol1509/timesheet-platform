import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { hashPassword } from "../src/lib/password";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
  const email = process.env.SEED_ADMIN_EMAIL ?? "admin@tickyourlist.com";
  const password = process.env.SEED_ADMIN_PASSWORD ?? "changeme123";
  const name = process.env.SEED_ADMIN_NAME ?? "Admin";

  const existing = await prisma.user.findUnique({ where: { email } });
  if (!existing) {
    await prisma.user.create({
      data: {
        email,
        name,
        passwordHash: hashPassword(password),
        role: "SUPER_ADMIN",
      },
    });
    console.log(`Created super admin user ${email} / ${password}`);
  } else {
    console.log(`Super admin user ${email} already exists, skipping.`);
  }

  await prisma.settings.upsert({
    where: { id: "singleton" },
    update: {},
    create: { id: "singleton" },
  });

  // No second branch is seeded any more. One used to be created here ("AUH —
  // Abu Dhabi Branch") purely to exercise branch scoping locally, along with a
  // branch admin carrying a default password — but this seed also runs against
  // production, so the fixture showed up in the live branch switcher and was
  // removed by prisma/scripts/remove-auh-branch.ts. Create throwaway branches
  // in a disposable database instead.
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
