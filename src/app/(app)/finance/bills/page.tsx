import Link from "next/link";
import { Download } from "lucide-react";
import { prisma } from "@/lib/db";
import { requireUserWithBranch, subjectOf } from "@/lib/auth";
import { branchWhere } from "@/lib/branch";
import { can } from "@/lib/permissions";
import { billStatus, billTotals } from "@/lib/payables";
import { BillsBoard } from "./bills-board";

export const metadata = { title: "Supplier bills" };
const FILTERS = [{ k: "", l: "All" }, { k: "OPEN", l: "Outstanding" }, { k: "OVERDUE", l: "Overdue" }, { k: "PAID", l: "Paid" }];

export default async function BillsPage({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
  const { user, branchId } = await requireUserWithBranch();
  const { view = "" } = await searchParams;
  const subject = subjectOf(user);
  const today = new Date();
  const [bills, suppliers] = await Promise.all([
    prisma.supplierBill.findMany({ where: branchWhere(branchId), orderBy: { dueDate: "asc" }, take: 500, include: { supplier: { select: { name: true } }, payments: { select: { amount: true } } } }),
    prisma.supplier.findMany({ where: { ...branchWhere(branchId), status: "ACTIVE" }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);
  const rows = bills.map((b) => {
    const t = billTotals({ amount: Number(b.amount), vatAmount: Number(b.vatAmount) }, b.payments.map((p) => ({ amount: Number(p.amount) })));
    return { id: b.id, supplier: b.supplier.name, billNo: b.billNo, billDate: b.billDate.toISOString().slice(0, 10), dueDate: b.dueDate.toISOString().slice(0, 10), ...t, status: billStatus(t.balance, t.paid, b.dueDate, today), description: b.description, paymentCount: b.payments.length };
  });
  const shown = rows.filter((r) => view === "OPEN" ? r.balance > 0 : view === "OVERDUE" ? r.status === "OVERDUE" : view === "PAID" ? r.status === "PAID" : true);
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div><h1 className="text-xl font-semibold tracking-tight text-primary">Supplier bills</h1><p className="mt-1 text-sm text-muted">What suppliers have billed us, what&apos;s been paid, and what&apos;s still owed. Suppliers with portal access can see their own bills.</p></div>
        {can(subject, "finance", "export") && <a href="/api/finance/export?type=bills" className="btn btn-secondary"><Download className="h-4 w-4" aria-hidden /> CSV</a>}
      </div>
      <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Filter">
        {FILTERS.map((f) => (
          <Link key={f.k || "all"} href={f.k ? `/finance/bills?view=${f.k}` : "/finance/bills"} role="tab" aria-selected={view === f.k}
            className={view === f.k ? "rounded-md bg-brand-soft px-3 py-1.5 text-sm font-medium text-[var(--brand-primary)]" : "rounded-md px-3 py-1.5 text-sm text-secondary hover:bg-surface-hover"}>{f.l}</Link>
        ))}
      </div>
      <BillsBoard rows={shown} suppliers={suppliers} canCreate={can(subject, "finance", "create")} canPay={can(subject, "finance", "edit")} canDelete={can(subject, "finance", "delete")} />
    </div>
  );
}
