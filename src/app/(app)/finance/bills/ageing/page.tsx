import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireUserWithBranch } from "@/lib/auth";
import { branchWhere } from "@/lib/branch";
import { AGEING_BUCKETS, ageingBucket, billTotals } from "@/lib/payables";
import { PageHeader } from "@/components/PageHeader";

export const metadata = { title: "Payables ageing" };
const aed = (n: number) => n.toLocaleString("en-AE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** What each supplier is owed, by how late it is. Only approved bills count as payable. */
export default async function AgeingPage() {
  const { branchId } = await requireUserWithBranch();
  const today = new Date();
  const bills = await prisma.supplierBill.findMany({
    where: { ...branchWhere(branchId), approvalStatus: "APPROVED" },
    include: { supplier: { select: { id: true, name: true } }, payments: { select: { amount: true } } },
  });

  const bySupplier = new Map<string, { id: string; name: string; buckets: number[]; total: number; bills: number }>();
  const totals = AGEING_BUCKETS.map(() => 0);
  for (const b of bills) {
    const t = billTotals({ amount: Number(b.amount), vatAmount: Number(b.vatAmount) }, b.payments.map((p) => ({ amount: Number(p.amount) })));
    if (t.balance <= 0) continue;
    const i = ageingBucket(b.dueDate, today);
    const row = bySupplier.get(b.supplierId) ?? { id: b.supplier.id, name: b.supplier.name, buckets: AGEING_BUCKETS.map(() => 0), total: 0, bills: 0 };
    row.buckets[i] += t.balance;
    row.total += t.balance;
    row.bills += 1;
    totals[i] += t.balance;
    bySupplier.set(b.supplierId, row);
  }
  const rows = [...bySupplier.values()].sort((a, b) => b.total - a.total);
  const grand = totals.reduce((s, n) => s + n, 0);
  const overdue = totals.slice(1).reduce((s, n) => s + n, 0);

  // Next 30 days of cash going out, by due date.
  const in30 = new Date(today.getTime() + 30 * 86_400_000);
  const upcoming = bills
    .map((b) => ({ b, bal: billTotals({ amount: Number(b.amount), vatAmount: Number(b.vatAmount) }, b.payments.map((p) => ({ amount: Number(p.amount) }))).balance }))
    .filter((x) => x.bal > 0 && x.b.dueDate >= today && x.b.dueDate <= in30)
    .sort((a, b) => a.b.dueDate.getTime() - b.b.dueDate.getTime())
    .slice(0, 8);

  return (
    <div className="space-y-5">
      <PageHeader title="Payables ageing" description="What each supplier is owed and how overdue it is. Only approved bills are counted." />

      <div className="card p-5">
        <div className="flex flex-wrap items-baseline gap-x-8 gap-y-2">
          <div><p className="text-[13px] font-medium text-muted">Total payable</p><p className="tabular text-3xl font-semibold tracking-tight text-primary">AED {aed(grand)}</p></div>
          <div><p className="text-[13px] font-medium text-muted">Overdue</p><p className={`tabular text-xl font-semibold ${overdue > 0 ? "text-[var(--error)]" : "text-primary"}`}>AED {aed(overdue)}</p></div>
        </div>
        {grand > 0 && (
          <div className="mt-4 flex h-2.5 gap-0.5 overflow-hidden rounded-full bg-[var(--surface-sunken)]">
            {totals.map((n, i) => n > 0 ? <span key={i} title={`${AGEING_BUCKETS[i]}: ${aed(n)}`} className={`h-full first:rounded-l-full last:rounded-r-full ${["bg-[var(--success)]", "bg-[var(--info)]", "bg-[var(--warning)]", "bg-[var(--warning)]", "bg-[var(--error)]"][i]}`} style={{ width: `${(n / grand) * 100}%` }} /> : null)}
          </div>
        )}
      </div>

      {rows.length === 0 ? (
        <div className="empty-state"><p className="text-sm text-muted">Nothing is owed to any supplier.</p></div>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-default bg-surface-subtle text-left text-xs font-medium uppercase tracking-wide text-muted">
              <tr><th className="px-4 py-3">Supplier</th>{AGEING_BUCKETS.map((l) => <th key={l} className="px-3 py-3 text-right">{l}</th>)}<th className="px-3 py-3 text-right">Total</th><th className="px-3 py-3" /></tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className="px-4 py-3"><p className="font-medium text-primary">{r.name}</p><p className="text-xs text-muted">{r.bills} open {r.bills === 1 ? "bill" : "bills"}</p></td>
                  {r.buckets.map((n, i) => <td key={i} className={`px-3 py-3 text-right tabular-nums ${n === 0 ? "text-subtle" : i >= 3 ? "font-medium text-[var(--error)]" : "text-secondary"}`}>{n === 0 ? "—" : aed(n)}</td>)}
                  <td className="px-3 py-3 text-right font-semibold tabular-nums text-primary">{aed(r.total)}</td>
                  <td className="px-3 py-3 text-right"><Link href={`/finance/bills/statement/${r.id}`} className="text-xs font-medium text-[var(--brand-primary)] hover:underline">Statement</Link></td>
                </tr>
              ))}
            </tbody>
            <tfoot className="border-t border-default bg-surface-subtle text-sm font-semibold">
              <tr><td className="px-4 py-3 text-primary">Total</td>{totals.map((n, i) => <td key={i} className="px-3 py-3 text-right tabular-nums text-primary">{aed(n)}</td>)}<td className="px-3 py-3 text-right tabular-nums text-primary">{aed(grand)}</td><td /></tr>
            </tfoot>
          </table>
        </div>
      )}

      {upcoming.length > 0 && (
        <section className="card p-5">
          <h2 className="mb-3 text-sm font-semibold text-primary">Due in the next 30 days</h2>
          <ul className="divide-y divide-[var(--border)] text-sm">
            {upcoming.map(({ b, bal }) => (
              <li key={b.id} className="flex justify-between gap-3 py-2">
                <span className="text-secondary">{b.dueDate.toISOString().slice(0, 10)} · {b.supplier.name} <span className="text-xs text-subtle">#{b.billNo}</span></span>
                <span className="tabular text-primary">{aed(bal)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
