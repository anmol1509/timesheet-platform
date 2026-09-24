import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireUserWithBranch } from "@/lib/auth";
import { branchWhere } from "@/lib/branch";
import { AGEING_BUCKETS, ageingBucket, billTotals } from "@/lib/payables";
import { budgetStatus, pettyCashBalance } from "@/lib/financeRules";

export const metadata = { title: "Finance" };
const aed = (n: number) => n.toLocaleString("en-AE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default async function FinancePage() {
  const { branchId } = await requireUserWithBranch();
  const today = new Date();
  const monthStart = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1));
  const sixMonthsAgo = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - 5, 1));
  const [bills, monthExpenses, pending, recent, budgets, topUps, cashRows, owedBack, billsToApprove] = await Promise.all([
    prisma.supplierBill.findMany({ where: { ...branchWhere(branchId), approvalStatus: "APPROVED" }, include: { supplier: { select: { name: true } }, payments: { select: { amount: true } } } }),
    prisma.expense.findMany({ where: { ...branchWhere(branchId), status: "APPROVED", date: { gte: monthStart } }, select: { category: true, amount: true, vatAmount: true } }),
    prisma.expense.count({ where: { ...branchWhere(branchId), status: "PENDING" } }),
    prisma.expense.findMany({ where: { ...branchWhere(branchId), status: "APPROVED", date: { gte: sixMonthsAgo } }, select: { date: true, amount: true, vatAmount: true, projectId: true, project: { select: { name: true } } } }),
    prisma.expenseBudget.findMany({ where: branchWhere(branchId), orderBy: { category: "asc" } }),
    prisma.pettyCashTopUp.findMany({ where: branchWhere(branchId), select: { amount: true } }),
    prisma.expense.findMany({ where: { ...branchWhere(branchId), status: "APPROVED", paymentMethod: "CASH" }, select: { amount: true, vatAmount: true } }),
    prisma.expense.findMany({ where: { ...branchWhere(branchId), status: "APPROVED", outOfPocket: true, reimbursedAt: null }, select: { amount: true, vatAmount: true } }),
    prisma.supplierBill.count({ where: { ...branchWhere(branchId), approvalStatus: "PENDING" } }),
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

  const monthKey = (d: Date) => `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
  const months = Array.from({ length: 6 }, (_, i) => monthKey(new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - 5 + i, 1))));
  const spendByMonth = new Map(months.map((m) => [m, 0]));
  const spendByProject = new Map<string, number>();
  for (const e of recent) {
    const t = Number(e.amount) + Number(e.vatAmount);
    const k = monthKey(e.date);
    if (spendByMonth.has(k)) spendByMonth.set(k, (spendByMonth.get(k) ?? 0) + t);
    if (k === months[months.length - 1]) spendByProject.set(e.project?.name ?? "No project", (spendByProject.get(e.project?.name ?? "No project") ?? 0) + t);
  }
  const trendMax = Math.max(1, ...spendByMonth.values());
  const projectSpend = [...spendByProject.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
  const budgetRows = budgets.map((b) => ({ category: b.category, limit: Number(b.monthlyLimit), spent: byCategory.get(b.category) ?? 0 })).map((b) => ({ ...b, ...budgetStatus(b.spent, b.limit) }));
  const petty = pettyCashBalance(topUps.map((t) => Number(t.amount)), cashRows.map((e) => Number(e.amount) + Number(e.vatAmount)));
  const owedToStaff = owedBack.reduce((s, e) => s + Number(e.amount) + Number(e.vatAmount), 0);

  return (
    <div className="space-y-5">
      <div><h1 className="text-xl font-semibold tracking-tight text-primary">Finance</h1><p className="mt-1 text-sm text-muted">Payables and spend at a glance.</p></div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Link href="/finance/bills?view=OPEN" className="card block p-4 hover:border-[var(--brand-primary)]"><p className="text-xs font-medium tracking-wide text-muted uppercase">Owed to suppliers</p><p className="mt-1 text-2xl font-semibold tabular-nums text-primary">AED {aed(outstanding)}</p></Link>
        <Link href="/finance/bills?view=OVERDUE" className="card block p-4 hover:border-[var(--brand-primary)]"><p className="text-xs font-medium tracking-wide text-muted uppercase">Overdue</p><p className="mt-1 text-2xl font-semibold tabular-nums text-[var(--error)]">AED {aed(buckets.slice(1).reduce((s, n) => s + n, 0))}</p></Link>
        <Link href="/finance/bills?view=REVIEW" className="card block p-4 hover:border-[var(--brand-primary)]"><p className="text-xs font-medium tracking-wide text-muted uppercase">Bills awaiting approval</p><p className="mt-1 text-2xl font-semibold tabular-nums text-primary">{billsToApprove}</p></Link>
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
      <div className="grid gap-4 lg:grid-cols-3">
        <section className="card p-5 lg:col-span-2">
          <h2 className="mb-1 text-sm font-semibold text-primary">Approved spend, last 6 months</h2>
          <p className="mb-4 text-xs text-subtle">Expenses only. Supplier bills and payroll are tracked in their own modules.</p>
          <div className="flex h-28 items-end gap-3">
            {months.map((m, i) => {
              const v = spendByMonth.get(m) ?? 0;
              return (
                <div key={m} className="flex flex-1 flex-col items-center gap-1" title={`${m}: AED ${aed(v)}`}>
                  {v > 0 && <span className="tabular text-[11px] text-secondary">{Math.round(v).toLocaleString("en-AE")}</span>}
                  <span className={`w-full max-w-10 rounded-t-[4px] ${i === months.length - 1 ? "bg-[var(--brand-primary)]" : "bg-[var(--brand-primary)]/30"}`} style={{ height: `${Math.max(v > 0 ? 6 : 2, (v / trendMax) * 72)}px` }} />
                  <span className="text-xs text-subtle">{m.slice(5)}</span>
                </div>
              );
            })}
          </div>
        </section>
        <section className="card p-5">
          <h2 className="mb-3 text-sm font-semibold text-primary">Cash on hand &amp; owed to staff</h2>
          <dl className="space-y-3 text-sm">
            <div className="flex items-baseline justify-between gap-3"><dt className="text-secondary">Petty cash float</dt><dd className={`tabular font-semibold ${petty < 0 ? "text-[var(--error)]" : "text-primary"}`}>AED {aed(petty)}</dd></div>
            <div className="flex items-baseline justify-between gap-3"><dt className="text-secondary">Out-of-pocket to reimburse</dt><dd className="tabular font-semibold text-primary">AED {aed(owedToStaff)}</dd></div>
          </dl>
        </section>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <section className="card p-5">
          <h2 className="mb-3 text-sm font-semibold text-primary">Budgets this month</h2>
          {budgetRows.length === 0 ? <p className="text-sm text-muted">No budgets set. Add them on the <Link href="/finance/expenses" className="text-[var(--brand-primary)] hover:underline">Expenses</Link> page.</p> : (
            <ul className="space-y-3">
              {budgetRows.map((b) => (
                <li key={b.category}>
                  <div className="flex items-baseline justify-between gap-3 text-sm"><span className="text-secondary">{b.category}</span><span className={`tabular ${b.state === "OVER" ? "font-medium text-[var(--error)]" : "text-primary"}`}>{b.pct}%</span></div>
                  <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-[var(--surface-sunken)]"><div className={`h-full rounded-full ${b.state === "OVER" ? "bg-[var(--error)]" : b.state === "NEAR" ? "bg-[var(--warning)]" : "bg-[var(--brand-primary)]"}`} style={{ width: `${Math.min(100, b.pct)}%` }} /></div>
                </li>
              ))}
            </ul>
          )}
        </section>
        <section className="card p-5">
          <h2 className="mb-3 text-sm font-semibold text-primary">Spend by project this month</h2>
          {projectSpend.length === 0 ? <p className="text-sm text-muted">No approved expenses yet this month.</p> : (
            <ul className="space-y-1.5 text-sm">{projectSpend.map(([name, n]) => <li key={name} className="flex justify-between gap-3"><span className="truncate text-secondary">{name}</span><span className="tabular text-primary">{aed(n)}</span></li>)}</ul>
          )}
        </section>
      </div>
    </div>
  );
}
