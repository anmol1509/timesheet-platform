import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireUserWithBranch, subjectOf } from "@/lib/auth";
import { isOutsideBranch } from "@/lib/branch";
import { can } from "@/lib/permissions";
import { depreciation, depreciationForYear } from "@/lib/depreciation";
import { Badge } from "@/components/Badge";
import { AssetHeaderActions, DeleteMaintenanceButton, MaintenanceForm } from "./asset-actions";

export const metadata = { title: "Asset" };
const aed = (n: number) => n.toLocaleString("en-AE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const day = (d: Date) => d.toISOString().slice(0, 10);

export default async function AssetPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { user, branchId, isSuperAdmin } = await requireUserWithBranch();
  const subject = subjectOf(user);
  const asset = await prisma.asset.findUnique({ where: { id }, include: { maintenance: { orderBy: { date: "desc" } } } });
  if (!asset || isOutsideBranch(asset.branchId, branchId, isSuperAdmin)) notFound();

  const input = { cost: Number(asset.cost), salvageValue: Number(asset.salvageValue), usefulLifeMonths: asset.usefulLifeMonths, purchaseDate: asset.purchaseDate, disposedOn: asset.disposedOn };
  const d = depreciation(input, new Date());
  const startYear = asset.purchaseDate.getUTCFullYear();
  const endYear = Math.min(startYear + Math.ceil(asset.usefulLifeMonths / 12), (asset.disposedOn ?? new Date(Date.UTC(startYear + 60, 0, 1))).getUTCFullYear());
  const years = Array.from({ length: Math.max(1, endYear - startYear + 1) }, (_, i) => startYear + i);
  const maintCost = asset.maintenance.reduce((s, m) => s + Number(m.cost), 0);
  const upcoming = asset.maintenance.filter((m) => m.nextDueDate).sort((a, b) => a.nextDueDate!.getTime() - b.nextDueDate!.getTime()).find((m) => m.nextDueDate! >= new Date(new Date().setUTCHours(0, 0, 0, 0)));

  const form = { id: asset.id, code: asset.code, name: asset.name, category: asset.category, serialNo: asset.serialNo ?? "", location: asset.location ?? "", purchaseDate: day(asset.purchaseDate), cost: String(Number(asset.cost)), salvageValue: String(Number(asset.salvageValue)), usefulLifeYears: String(asset.usefulLifeMonths / 12), notes: asset.notes ?? "" };

  return (
    <div className="space-y-5">
      <Link href="/assets" className="text-xs text-muted hover:text-secondary">← Asset register</Link>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2"><h1 className="text-xl font-semibold tracking-tight text-primary">{asset.name}</h1>{asset.status === "DISPOSED" ? <Badge color="slate">Disposed {asset.disposedOn && day(asset.disposedOn)}</Badge> : d.fullyDepreciated ? <Badge color="amber">Fully depreciated</Badge> : <Badge color="green">In service</Badge>}</div>
          <p className="mt-1 text-sm text-muted">{asset.code} · {asset.category}{asset.serialNo ? ` · ${asset.serialNo}` : ""}{asset.location ? ` · ${asset.location}` : ""}</p>
        </div>
        <AssetHeaderActions value={form} disposed={asset.status === "DISPOSED"} canEdit={can(subject, "assets", "edit")} canDelete={can(subject, "assets", "delete")} />
      </div>

      <div className="grid gap-4 sm:grid-cols-4">
        {[["Cost", aed(input.cost)], ["Monthly depreciation", aed(d.monthlyCharge)], ["Accumulated", aed(d.accumulated)], ["Net book value", aed(d.bookValue)]].map(([l, v]) => (
          <div key={l} className="card p-4"><p className="text-xs font-medium tracking-wide text-muted uppercase">{l}</p><p className="mt-1 text-xl font-semibold tabular-nums text-primary">AED {v}</p></div>
        ))}
      </div>
      {asset.status === "DISPOSED" && asset.disposalValue !== null && (
        <p className="text-sm text-secondary">Disposed for AED {aed(Number(asset.disposalValue))} — {Number(asset.disposalValue) - d.bookValue >= 0 ? "gain" : "loss"} of AED {aed(Math.abs(Number(asset.disposalValue) - d.bookValue))} against book value.</p>
      )}

      <section className="card p-5">
        <h2 className="mb-3 text-sm font-semibold text-primary">Depreciation schedule</h2>
        <p className="mb-2 text-xs text-muted">Straight line over {asset.usefulLifeMonths / 12} years, salvage value AED {aed(input.salvageValue)}. {d.monthsElapsed} of {asset.usefulLifeMonths} months elapsed.</p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs font-medium uppercase tracking-wide text-muted"><tr><th className="py-2">Year</th><th className="py-2 text-right">Charge</th><th className="py-2 text-right">Book value at 31 Dec</th></tr></thead>
            <tbody className="divide-y divide-[var(--border)]">
              {years.map((y) => (
                <tr key={y}><td className="py-2 text-secondary">{y}</td><td className="py-2 text-right tabular-nums text-secondary">{aed(depreciationForYear(input, y))}</td><td className="py-2 text-right tabular-nums text-primary">{aed(depreciation(input, new Date(Date.UTC(y, 11, 31))).bookValue)}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        {can(subject, "assets", "edit") && <MaintenanceForm assetId={asset.id} />}
        <section className="card p-4">
          <h2 className="mb-1 text-sm font-semibold text-primary">Maintenance history</h2>
          <p className="mb-3 text-xs text-muted">Total spent AED {aed(maintCost)}{upcoming ? ` · next due ${day(upcoming.nextDueDate!)}` : ""}</p>
          {asset.maintenance.length === 0 ? <p className="text-sm text-muted">Nothing logged yet.</p> : (
            <ul className="divide-y divide-[var(--border)] text-sm">
              {asset.maintenance.map((m) => (
                <li key={m.id} className="flex items-start justify-between gap-3 py-2">
                  <div className="min-w-0"><p className="text-primary">{m.description}</p><p className="text-xs text-muted">{day(m.date)}{m.doneBy ? ` · ${m.doneBy}` : ""}{Number(m.cost) > 0 ? ` · AED ${aed(Number(m.cost))}` : ""}{m.nextDueDate ? ` · next ${day(m.nextDueDate)}` : ""}</p></div>
                  {can(subject, "assets", "delete") && <DeleteMaintenanceButton id={m.id} />}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
