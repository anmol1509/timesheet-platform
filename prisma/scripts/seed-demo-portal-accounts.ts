/**
 * Creates (or removes) the demo supplier and demo employee used to show the
 * supplier and employee portals.
 *
 *   - supplier "DEMO Supplier Co", portal enabled
 *   - employee "DEMO-0001", self-service enabled, working for that supplier
 *   - one approved demo bill with a part-payment, so the Payments page has content
 * Both carry the placeholder phone in src/lib/ess/demoLogin.ts. Sign-in is by the
 * fixed DEMO_LOGIN_CODE environment variable (see that file); nothing is ever
 * sent to the phone.
 *
 * The demo employee has NO pay structure, so it never enters a payroll run, but
 * it and the demo supplier do appear in that branch's lists and headcount. Run
 * with REMOVE=1 to delete everything this script created.
 *
 * Read-only by default. Pass APPLY=1 to write.
 *   APPLY=1 npx tsx prisma/scripts/seed-demo-portal-accounts.ts
 *   REMOVE=1 APPLY=1 npx tsx prisma/scripts/seed-demo-portal-accounts.ts
 */
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../../src/generated/prisma/client";
import { DEMO_PHONE } from "../../src/lib/ess/demoLogin";

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });
const APPLY = process.env.APPLY === "1";
const REMOVE = process.env.REMOVE === "1";

const SUPPLIER_NAME = "DEMO Supplier Co";
const EMPLOYEE_ID = "DEMO-0001";

async function main() {
  const branch = await prisma.branch.findUnique({ where: { code: "MAIN" } });
  if (!branch) throw new Error("MAIN branch not found — refusing to run.");
  const supplier = await prisma.supplier.findUnique({ where: { name: SUPPLIER_NAME } });
  const employee = await prisma.employee.findUnique({ where: { employeeIdNo: EMPLOYEE_ID } });

  if (REMOVE) {
    console.log(`Would remove: supplier ${supplier ? "yes" : "no"}, employee ${employee ? "yes" : "no"} (and the demo bill).`);
    if (!APPLY) return console.log("Dry run. Pass APPLY=1 to delete.");
    if (supplier) await prisma.billPayment.deleteMany({ where: { bill: { supplierId: supplier.id } } });
    if (supplier) await prisma.supplierBill.deleteMany({ where: { supplierId: supplier.id } });
    if (employee) await prisma.employee.delete({ where: { id: employee.id } });
    if (supplier) await prisma.supplier.delete({ where: { id: supplier.id } });
    return console.log("Demo accounts removed.");
  }

  console.log(`Branch MAIN. Supplier ${supplier ? "exists" : "will be created"}; employee ${employee ? "exists" : "will be created"}.`);
  if (!APPLY) return console.log("Dry run. Pass APPLY=1 to create.");

  const sup =
    supplier ??
    (await prisma.supplier.create({
      data: { name: SUPPLIER_NAME, branchId: branch.id, portalEnabled: true, contactPhone: DEMO_PHONE, status: "ACTIVE", approvalStatus: "Approved", labourApprovalStatus: "Approved", invoiceApprovalStatus: "Approved" },
    }));
  if (!employee) {
    await prisma.employee.create({
      data: { employeeIdNo: EMPLOYEE_ID, name: "DEMO Employee", branchId: branch.id, supplierId: sup.id, essEnabled: true, mobileNumber: DEMO_PHONE, status: "ACTIVE", trade: "Helper" },
    });
  }
  const hasBill = await prisma.supplierBill.count({ where: { supplierId: sup.id } });
  if (!hasBill) {
    const bill = await prisma.supplierBill.create({
      data: { billNo: "DEMO-001", billDate: new Date(), dueDate: new Date(Date.now() + 30 * 86_400_000), amount: 10000, vatAmount: 500, description: "Demo labour supply", approvalStatus: "APPROVED", supplierId: sup.id, branchId: branch.id },
    });
    const anyUser = await prisma.user.findFirst({ select: { id: true } });
    if (anyUser) await prisma.billPayment.create({ data: { billId: bill.id, paidOn: new Date(), amount: 4000, method: "BANK", reference: "DEMO-TRF", createdById: anyUser.id } });
  }
  console.log("Demo accounts ready.");
}

main().finally(() => prisma.$disconnect());
