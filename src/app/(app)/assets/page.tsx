import Link from "next/link";
import { Download } from "lucide-react";
import { prisma } from "@/lib/db";
import { requireUserWithBranch, subjectOf } from "@/lib/auth";
import { branchWhere } from "@/lib/branch";
import { can } from "@/lib/permissions";
import { depreciation } from "@/lib/depreciation";
import { Badge } from "@/components/Badge";
import { AddAssetButton } from "./assets-manager";

export const metadata = { title: "Asset register" };
const aed = (n: number) => n.toLocaleString("en-AE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default async function AssetsPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const { user, branchId } = await requireUserWithBranch();
  const { status = "ACTIVE" } = await searchParams;
  const subject = subjectOf(user);
  const today = new Date();
  const assets = await prisma.asset.findMany({ where: { ...branchWhere(branchId), ...(status === "ALL" ? {} : { status: status === "DISPOSED" ? "DISPOSED" : "ACTIVE" }) }, orderBy: { code: "asc" }, take: 1000 });
  const rows = assets.map((a) => ({ a, d: depreciation({ cost: Number(a.cost), salvageValue: Number(a.salvageValue), usefulLifeMonths: a.usefulLifeMonths, purchaseDate: a.purchaseDate, disposedOn: a.disposedOn }, today) }));
  const totals = rows.reduce((s, r) => ({ cost: s.cost + Number(r.a.cost), acc: s.acc + r.d.accumulated, nbv: s.nbv + r.d.bookValue }), { cost: 0, acc: 0, nbv: 0 });
  const tabs = [["ACTIVE", "In service"], ["DISPOSED", "Disposed"], ["ALL", "All"]];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div><h1 className="text-xl font-semibold tracking-tight text-primary">Asset register</h1><p className="mt-1 text-sm text-muted">Equipment, vehicles and furniture with straight-line depreciation and maintenance history.</p></div>
        <div className="flex gap-2">
          {can(subject, "assets", "export") && <a href="/api/assets/export" className="btn btn-secondary"><Download className="h-4 w-4" aria-hidden /> CSV</a>}
          {can(subject, "assets", "create") && branchId && <AddAssetButton />}
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="card p-4"><p className="text-xs font-medium tracking-wide text-muted uppercase">Total cost</p><p className="mt-1 text-xl font-semibold tabular-nums text-primary">AED {aed(totals.cost)}</p></div>
        <div className="card p-4"><p className="text-xs font-medium tracking-wide text-muted uppercase">Accumulated depreciation</p><p className="mt-1 text-xl font-semibold tabular-nums text-primary">AED {aed(totals.acc)}</p></div>
        <div className="card p-4"><p className="text-xs font-medium tracking-wide text-muted uppercase">Net book value</p><p className="mt-1 text-xl font-semibold tabular-nums text-primary">AED {aed(totals.nbv)}</p></div>
      </div>
      <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Filter">
        {tabs.map(([k, l]) => <Link key={k} href={`/assets?status=${k}`} role="tab" aria-selected={status === k} className={status === k ? "rounded-md bg-brand-soft px-3 py-1.5 text-sm font-medium text-[var(--brand-primary)]" : "rounded-md px-3 py-1.5 text-sm text-secondary hover:bg-surface-hover"}>{l}</Link>)}
      </div>
      {rows.length === 0 ? <div className="card p-10 text-center text-sm text-muted">No assets here yet.</div> : (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-default bg-surface-subtle text-left text-xs font-medium uppercase tracking-wide text-muted">
              <tr><th className="px-4 py-3">Asset</th><th className="px-3 py-3">Purchased</th><th className="px-3 py-3 text-right">Cost</th><th className="px-3 py-3 text-right">Accum. dep.</th><th className="px-3 py-3 text-right">Book value</th><th className="px-3 py-3">Status</th></tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {rows.map(({ a, d }) => (
                <tr key={a.id} className="hover:bg-surface-hover">
                  <td className="px-4 py-3"><Link href={`/assets/${a.id}`} className="font-medium text-primary hover:underline">{a.name}</Link><p className="text-xs text-muted">{a.code} · {a.category}{a.location ? ` · ${a.location}` : ""}</p></td>
                  <td className="px-3 py-3 whitespace-nowrap text-secondary">{a.purchaseDate.toISOString().slice(0, 10)}</td>
                  <td className="px-3 py-3 text-right tabular-nums text-secondary">{aed(Number(a.cost))}</td>
                  <td className="px-3 py-3 text-right tabular-nums text-secondary">{aed(d.accumulated)}</td>
                  <td className="px-3 py-3 text-right font-medium tabular-nums text-primary">{aed(d.bookValue)}</td>
                  <td className="px-3 py-3">{a.status === "DISPOSED" ? <Badge color="slate">Disposed</Badge> : d.fullyDepreciated ? <Badge color="amber">Fully depreciated</Badge> : <Badge color="green">In service</Badge>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
