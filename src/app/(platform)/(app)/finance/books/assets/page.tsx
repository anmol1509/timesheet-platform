import { Building2 } from "lucide-react";
import { prisma } from "@/lib/db";
import { PageHeader } from "@/components/PageHeader";
import { accumulated, bookValue, monthlyCharge, type AssetFacts } from "@/lib/books/assets";
import { isMoneyAccount } from "@/lib/books/ledger";
import { aed, fmtDate, getBooksContext, iso } from "../books-data";
import { SetupCard } from "../setup-card";
import { AddAsset, AssetRowActions } from "./asset-forms";

export const metadata = { title: "Fixed assets" };

export default async function AssetsPage() {
  const ctx = await getBooksContext();
  const header = (right?: React.ReactNode) => <PageHeader title="Fixed assets" icon={Building2} breadcrumbs={[{ label: "Finance", href: "/finance/bills" }, { label: "Accounting", href: "/finance/books" }, { label: "Assets" }]} description="Vehicles, furniture and equipment, written off evenly over their life. Depreciation posts itself each month." actions={right} />;
  if (!ctx.branch || !ctx.initialized) return <div className="space-y-5">{header()}<SetupCard isAdmin={ctx.isAdmin} /></div>;
  const [rows, accounts] = await Promise.all([
    prisma.fixedAsset.findMany({ where: { branchId: ctx.branch.id }, orderBy: [{ purchaseDate: "desc" }] }),
    prisma.account.findMany({ where: { branchId: ctx.branch.id, isActive: true }, orderBy: { code: "asc" }, select: { id: true, code: true, name: true, type: true, tag: true, bankId: true } }),
  ]);
  const now = new Date();
  const month = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
  const facts = (a: (typeof rows)[number]): AssetFacts => ({ id: a.id, name: a.name, cost: Number(a.cost), salvage: Number(a.salvage), purchaseDate: a.purchaseDate, lifeMonths: a.lifeMonths, paidFromAccountId: a.paidFromAccountId, disposedOn: a.disposedOn, disposalAmount: a.disposalAmount == null ? null : Number(a.disposalAmount), disposalAccountId: a.disposalAccountId });
  const money = accounts.filter(isMoneyAccount).map((a) => ({ id: a.id, label: `${a.code} · ${a.name}` }));
  const payFrom = accounts.filter((a) => isMoneyAccount(a) || a.tag === "PAYABLE").map((a) => ({ id: a.id, label: `${a.code} · ${a.name}` }));
  const live = rows.filter((a) => !a.disposedOn);
  const totals = live.reduce((t, a) => { const f = facts(a); return { cost: t.cost + f.cost, acc: t.acc + accumulated(f, month), nbv: t.nbv + bookValue(f, month) }; }, { cost: 0, acc: 0, nbv: 0 });
  return (
    <div className="space-y-5">
      {header(ctx.canWrite ? <AddAsset accounts={payFrom} minDate={iso(ctx.branch.booksOpeningDate!)} /> : undefined)}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {[["Cost of assets in use", totals.cost], ["Written off so far", totals.acc], ["Worth on the books", totals.nbv]].map(([l, v]) => (
          <div key={l as string} className="rounded-[var(--radius-card)] border border-default bg-surface p-4"><p className="text-xs text-muted">{l as string}</p><p className="tabular mt-1 text-lg font-semibold text-primary">{aed(v as number)}</p></div>
        ))}
      </div>
      <section className="overflow-x-auto rounded-[var(--radius-card)] border border-default bg-surface">
        {rows.length === 0 ? <p className="px-4 py-8 text-center text-sm text-muted">No assets yet. Add the first one and its depreciation will post every month.</p> : (
          <table className="w-full text-sm">
            <thead className="bg-[var(--surface-sunken)] text-left text-xs text-muted"><tr><th className="px-4 py-2 font-medium">Asset</th><th className="px-3 py-2 font-medium">Bought</th><th className="px-3 py-2 text-right font-medium">Cost</th><th className="px-3 py-2 text-right font-medium">Per month</th><th className="px-3 py-2 text-right font-medium">Written off</th><th className="px-3 py-2 text-right font-medium">Worth now</th><th className="px-4 py-2" /></tr></thead>
            <tbody className="divide-y divide-default">
              {rows.map((a) => {
                const f = facts(a);
                const gone = !!a.disposedOn;
                return (
                  <tr key={a.id} className={gone ? "text-muted" : ""}>
                    <td className="px-4 py-2"><span className="font-medium text-primary">{a.name}</span>{a.category && <span className="ml-2 text-xs text-muted">{a.category}</span>}{gone && <span className="ml-2 rounded-full bg-[var(--surface-sunken)] px-2 py-0.5 text-[11px]">Sold {fmtDate(a.disposedOn!)}</span>}</td>
                    <td className="px-3 py-2">{fmtDate(a.purchaseDate)}</td>
                    <td className="tabular px-3 py-2 text-right">{aed(f.cost)}</td>
                    <td className="tabular px-3 py-2 text-right">{gone ? "–" : aed(monthlyCharge(f, month) || (f.cost - f.salvage) / f.lifeMonths)}</td>
                    <td className="tabular px-3 py-2 text-right">{aed(accumulated(f, month))}</td>
                    <td className="tabular px-3 py-2 text-right font-medium text-primary">{gone ? "–" : aed(bookValue(f, month))}</td>
                    <td className="px-4 py-1.5">{ctx.canWrite && <AssetRowActions id={a.id} name={a.name} moneyAccounts={money} sold={gone} />}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
