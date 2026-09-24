import Link from "next/link";
import { prisma } from "@/lib/db";
import { getVendor } from "@/lib/vendor/session";
import { Badge, type BadgeColor } from "@/components/Badge";
import { billTotals } from "@/lib/payables";

export const metadata = { title: "Supplier portal" };
const aed = (n: number) => n.toLocaleString("en-AE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const APPROVAL: Record<string, BadgeColor> = { Approved: "green", Pending: "amber", Rejected: "red" };
const DAY = 86_400_000;

export default async function VendorHome() {
  const vendor = (await getVendor())!;
  const soon = new Date(new Date().getTime() + 30 * DAY);
  const [workers, byStatus, expiring, bills] = await Promise.all([
    prisma.employee.count({ where: { supplierId: vendor.id, status: { not: "TERMINATED" } } }),
    prisma.employee.groupBy({ by: ["status"], where: { supplierId: vendor.id, status: { not: "TERMINATED" } }, _count: true }),
    prisma.employee.count({
      where: {
        supplierId: vendor.id,
        status: { not: "TERMINATED" },
        OR: [{ visaExpiry: { lte: soon } }, { laborCardExpiry: { lte: soon } }, { medicalExpiry: { lte: soon } }, { passportExpiry: { lte: soon } }, { emiratesIdExpiry: { lte: soon } }],
      },
    }),
    prisma.supplierBill.findMany({ where: { supplierId: vendor.id, approvalStatus: "APPROVED" }, include: { payments: { select: { amount: true } } } }),
  ]);
  const owed = bills.reduce((s, b) => s + billTotals({ amount: Number(b.amount), vatAmount: Number(b.vatAmount) }, b.payments.map((p) => ({ amount: Number(p.amount) }))).balance, 0);
  const active = byStatus.find((x) => x.status === "ACTIVE")?._count ?? 0;

  return (
    <>
      <section className="card p-5">
        <p className="text-sm text-muted">Welcome</p>
        <h1 className="text-xl font-semibold tracking-tight text-primary">{vendor.fullName ?? vendor.name}</h1>
        <div className="mt-3 flex flex-wrap gap-2 text-xs">
          <Badge color={APPROVAL[vendor.approvalStatus] ?? "slate"}>Supplier: {vendor.approvalStatus}</Badge>
          <Badge color={APPROVAL[vendor.labourApprovalStatus] ?? "slate"}>Labour: {vendor.labourApprovalStatus}</Badge>
          <Badge color={APPROVAL[vendor.invoiceApprovalStatus] ?? "slate"}>Invoicing: {vendor.invoiceApprovalStatus}</Badge>
        </div>
      </section>
      <div className="grid gap-4 sm:grid-cols-3">
        <Link href="/vendor/workers" className="card block p-4 hover:border-[var(--brand-primary)]">
          <p className="text-xs font-medium tracking-wide text-muted uppercase">Your workers</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums text-primary">{workers}</p>
          <p className="text-xs text-muted">{active} working</p>
        </Link>
        <Link href="/vendor/workers" className="card block p-4 hover:border-[var(--brand-primary)]">
          <p className="text-xs font-medium tracking-wide text-muted uppercase">Documents due in 30 days</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums text-primary">{expiring}</p>
          <p className="text-xs text-muted">workers need a renewal</p>
        </Link>
        <Link href="/vendor/payments" className="card block p-4 hover:border-[var(--brand-primary)]">
          <p className="text-xs font-medium tracking-wide text-muted uppercase">Outstanding</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums text-primary">AED {aed(owed)}</p>
          <p className="text-xs text-muted">across {bills.length} bill{bills.length === 1 ? "" : "s"}</p>
        </Link>
      </div>
    </>
  );
}
