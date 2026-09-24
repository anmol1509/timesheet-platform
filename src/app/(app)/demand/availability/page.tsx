import { prisma } from "@/lib/db";
import { requireUserWithBranch } from "@/lib/auth";
import { branchWhere } from "@/lib/branch";
import { PageHeader } from "@/components/PageHeader";

export const metadata = { title: "Supplier availability" };

/** Manpower suppliers say they can provide, by trade — for planning upcoming requests. */
export default async function SupplierAvailabilityPage() {
  const { branchId } = await requireUserWithBranch();
  const today = new Date(); today.setUTCHours(0, 0, 0, 0);
  const rows = await prisma.supplierAvailability.findMany({
    where: { ...branchWhere(branchId), date: { gte: today } },
    orderBy: [{ trade: "asc" }, { date: "asc" }],
    include: { supplier: { select: { name: true } } },
  });
  const byTrade = new Map<string, { total: number; rows: typeof rows }>();
  for (const r of rows) {
    const t = byTrade.get(r.trade) ?? { total: 0, rows: [] };
    t.total += r.count; t.rows.push(r); byTrade.set(r.trade, t);
  }
  const grand = rows.reduce((s, r) => s + r.count, 0);

  return (
    <div className="space-y-5">
      <PageHeader title="Supplier availability" description="What suppliers have told us they can provide. Use it when deciding who to send a request to." />
      {rows.length === 0 ? (
        <div className="empty-state"><p className="text-sm text-muted">No supplier has declared availability yet. They can add it under Availability in their portal.</p></div>
      ) : (
        <>
          <p className="text-sm text-muted"><span className="tabular text-2xl font-semibold text-primary">{grand}</span> workers declared across {byTrade.size} trade{byTrade.size === 1 ? "" : "s"}.</p>
          <div className="grid gap-4 lg:grid-cols-2">
            {[...byTrade.entries()].sort((a, b) => b[1].total - a[1].total).map(([trade, t]) => (
              <section key={trade} className="card overflow-hidden">
                <div className="flex items-center justify-between border-b border-default px-5 py-3"><h2 className="text-sm font-semibold text-primary">{trade}</h2><span className="tabular text-sm font-semibold text-primary">{t.total}</span></div>
                <ul className="divide-y divide-[var(--border)] text-sm">
                  {t.rows.map((r) => (
                    <li key={r.id} className="flex items-center justify-between gap-3 px-5 py-2.5">
                      <span className="min-w-0"><span className="text-secondary">{r.supplier.name}</span><span className="ml-2 text-xs text-muted">from {r.date.toISOString().slice(0, 10)}{r.note ? ` · ${r.note}` : ""}</span></span>
                      <span className="tabular font-medium text-primary">{r.count}</span>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
