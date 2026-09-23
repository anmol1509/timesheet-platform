import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireUserWithBranch } from "@/lib/auth";
import { branchWhere } from "@/lib/branch";
import { AGEING_BUCKETS, ageingBucket, billTotals } from "@/lib/payables";

export const metadata = { title: "Finance" };
const aed = (n: number) => n.toLocaleString("en-AE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default async function FinancePage() {
  const { branchId } = await requireUserWithBranch();
  const today = new Date();
  const monthStart = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1));
  const [bills, monthExpenses, pending] = await Promise.all([
    prisma.supplierBill.findMany({ where: branchWhere(branchId), include: { supplier: { select: { name: true } }, payments: { select: { amount: true } } } }),
    prisma.expense.findMany({ where: { ...branchWhere(branchId), status: "APPROVED", date: { gte: monthStart } }, select: { category: true, amount: true, vatAmount: true } }),
    prisma.expense.count({ where: { ...branchWhere(branchId), status: "PENDING" } }),
  ]);

  const buckets = AGEING_BUCKETS.map(() => 0);
  const bySupplier = new Map<string, number>();
  let outstanding = 0;
  for (const b of bills) {
    const t = billTotals({ amount: Number(b.amount), vatAmount: Number(b.vatAmount) }, b.payments.map((p) => ({ amount: Number(p.amount) })));
    if (t.balance <= 0) continue;
    outstanding += t.balance;
    buckets[ageingBucket(b.dueDate, today)] += t.balance;
    bySupplier.set(b.supplier.name, (bySupplier.get(b.supplier.name) ?? 0) + t.balance);
  }
  const byCategory = new Map<string, number>();
  for (const e of monthExpenses) byCategory.set(e.category, (byCategory.get(e.category) ?? 0) + Number(e.amount) + Number(e.vatAmount));
  const spent = [...byCategory.values()].reduce((s, n) => s + n, 0);
  const topSuppliers = [...bySupplier.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6);
  const cats = [...byCategory.entries()].sort((a, b) => b[1] - a[1]);

  return (
    <div className="space-y-5">
      <div><h1 className="text-xl font-semibold tracking-tight text-primary">Finance</h1><p className="mt-1 text-sm text-muted">Payables and spend at a glance.</p></div>
      <div className="grid gap-4 sm:grid-cols-3">
        <Link href="/finance/bills?view=OPEN" className="card block p-4 hover:border-[var(--brand-primary)]"><p className="text-xs font-medium tracking-wide text-muted uppercase">Owed to suppliers</p><p className="mt-1 text-2xl font-semibold tabular-nums text-primary">AED {aed(outstanding)}</p></Link>
        <Link href="/finance/bills?view=OVERDUE" className="card block p-4 hover:border-[var(--brand-primary)]"><p className="text-xs font-medium tracking-wide text-muted uppercase">Overdue</p><p className="mt-1 text-2xl font-semibold tabular-nums text-[var(--error)]">AED {aed(buckets.slice(1).reduce((s, n) => s + n, 0))}</p></Link>
        <Link href="/finance/expenses?status=PENDING" className="card block p-4 hover:border-[var(--brand-primary)]"><p className="text-xs font-medium tracking-wide text-muted uppercase">Expenses awaiting approval</p><p className="mt-1 text-2xl font-semibold tabular-nums text-primary">{pending}</p></Link>
      </div>
      <section className="card p-5">
        <h2 className="mb-3 text-sm font-semibold text-primary">Payables ageing</h2>
        <div className="grid gap-3 sm:grid-cols-5">
          {AGEING_BUCKETS.map((label, i) => (
            <div key={label}><p className="text-xs text-muted">{label}</p><p className={i >= 3 && buckets[i] > 0 ? "mt-0.5 text-lg font-semibold tabular-nums text-[var(--error)]" : "mt-0.5 text-lg font-semibold tabular-nums text-primary"}>{aed(buckets[i])}</p></div>
          ))}
        </div>
      </section>
      <div className="grid gap-4 lg:grid-cols-2">
        <section className="card p-5">
          <h2 className="mb-3 text-sm font-semibold text-primary">Biggest balances</h2>
          {topSuppliers.length === 0 ? <p className="text-sm text-muted">Nothing outstanding.</p> : (
            <ul className="space-y-1.5 text-sm">{topSuppliers.map(([name, n]) => <li key={name} className="flex justify-between gap-3"><span className="truncate text-secondary">{name}</span><span className="tabular-nums text-primary">{aed(n)}</span></li>)}</ul>
          )}
        </section>
        <section className="card p-5">
          <h2 className="mb-3 text-sm font-semibold text-primary">Approved spend this month <span className="font-normal text-muted">· AED {aed(spent)}</span></h2>
          {cats.length === 0 ? <p className="text-sm text-muted">No approved expenses yet this month.</p> : (
            <ul className="space-y-1.5 text-sm">{cats.map(([c, n]) => <li key={c} className="flex justify-between gap-3"><span className="truncate text-secondary">{c}</span><span className="tabular-nums text-primary">{aed(n)}</span></li>)}</ul>
          )}
        </section>
      </div>
    </div>
  );
}
