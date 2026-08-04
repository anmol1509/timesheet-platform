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

  // A second branch + a branch-scoped admin, purely so branch scoping is
  // easy to verify locally (the production MAIN branch already exists from
  // the migration backfill).
  const secondBranch = await prisma.branch.upsert({
    where: { code: "AUH" },
    update: {},
    create: { code: "AUH", name: "Abu Dhabi Branch", emirate: "Abu Dhabi" },
  });

  const branchAdminEmail =
    process.env.SEED_BRANCH_ADMIN_EMAIL ?? "branchadmin@tickyourlist.com";
  const branchAdminPassword = process.env.SEED_BRANCH_ADMIN_PASSWORD ?? "changeme123";
  const existingBranchAdmin = await prisma.user.findUnique({
    where: { email: branchAdminEmail },
  });
  if (!existingBranchAdmin) {
    await prisma.user.create({
      data: {
        email: branchAdminEmail,
        name: "Abu Dhabi Branch Admin",
        passwordHash: hashPassword(branchAdminPassword),
        role: "BRANCH_ADMIN",
        branchId: secondBranch.id,
      },
    });
    console.log(`Created branch admin user ${branchAdminEmail} / ${branchAdminPassword}`);
  } else {
    console.log(`Branch admin user ${branchAdminEmail} already exists, skipping.`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
