/**
 * Removes the AUH — Abu Dhabi Branch seed fixture from a database.
 *
 * The branch came from prisma/seed.ts, where it existed purely to exercise
 * branch scoping locally, but the seed also ran against production. Everything
 * under it is scratch data ("Test Employee", suppliers "t"/"y"), so it's
 * deleted rather than merged into MAIN. Audit rows are repointed at MAIN
 * instead of deleted, so the change history stays readable.
 *
 * Runs read-only by default. Pass APPLY=1 to actually write.
 */
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../../src/generated/prisma/client";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

const APPLY = process.env.APPLY === "1";

async function main() {
  const auh = await prisma.branch.findUnique({ where: { code: "AUH" } });
  const main = await prisma.branch.findUnique({ where: { code: "MAIN" } });
  if (!auh) return console.log("AUH branch not found — nothing to do.");
  if (!main) throw new Error("MAIN branch not found — refusing to run.");

  const employees = await prisma.employee.findMany({ where: { branchId: auh.id } });
  const suppliers = await prisma.supplier.findMany({ where: { branchId: auh.id } });
  const users = await prisma.user.findMany({ where: { branchId: auh.id } });
  const lookups = await prisma.lookupValue.findMany({ where: { branchId: auh.id } });
  const auditCount = await prisma.auditLog.count({ where: { branchId: auh.id } });

  // Refuse to delete anything carrying real history — this fixture shouldn't
  // have any, and if it does, that assumption needs re-checking by hand.
  for (const e of employees) {
    const [entries, attendance, nocs, allocations] = await Promise.all([
      prisma.timesheetEntry.count({ where: { employeeIdNo: e.employeeIdNo } }),
      prisma.attendance.count({ where: { employeeId: e.id } }),
      prisma.nocEmployee.count({ where: { employeeId: e.id } }),
      prisma.demandRequestAllocation.count({ where: { employeeId: e.id } }),
    ]);
    if (entries || attendance || nocs || allocations) {
      throw new Error(
        `${e.employeeIdNo} ${e.name} has history (timesheet=${entries} attendance=${attendance} noc=${nocs} alloc=${allocations}) — resolve by hand.`
      );
    }
  }
  for (const s of suppliers) {
    const entries = await prisma.timesheetEntry.count({ where: { supplierId: s.id } });
    if (entries) throw new Error(`Supplier "${s.name}" has ${entries} timesheet rows — resolve by hand.`);
  }

  console.log(APPLY ? "APPLYING:" : "DRY RUN — no writes. Would:");
  employees.forEach((e) => console.log(`  delete employee ${e.employeeIdNo} — ${e.name}`));
  suppliers.forEach((s) => console.log(`  delete supplier "${s.name}"`));
  users.forEach((u) => console.log(`  delete user ${u.email}`));
  console.log(`  delete ${lookups.length} lookup value(s)`);
  console.log(`  repoint ${auditCount} audit row(s) to MAIN`);
  console.log(`  delete branch ${auh.code} — ${auh.name}`);
  if (!APPLY) return;

  await prisma.$transaction(async (tx) => {
    // Beds and supplier links first, so nothing points at a row being removed.
    await tx.bed.updateMany({
      where: { employeeId: { in: employees.map((e) => e.id) } },
      data: { employeeId: null },
    });
    await tx.employee.deleteMany({ where: { branchId: auh.id } });
    await tx.supplier.deleteMany({ where: { branchId: auh.id } });
    await tx.user.deleteMany({ where: { branchId: auh.id } });
    await tx.lookupValue.deleteMany({ where: { branchId: auh.id } });
    await tx.auditLog.updateMany({
      where: { branchId: auh.id },
      data: { branchId: main.id },
    });
    await tx.branch.delete({ where: { id: auh.id } });
  });
  console.log("Done.");
}

main().finally(() => process.exit(0));
