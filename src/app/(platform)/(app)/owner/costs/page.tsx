import Link from "next/link";
import { ArrowLeft, Gauge } from "lucide-react";
import { HeroHeader } from "@/components/HeroHeader";
import { requireOwner } from "@/lib/ownerServer";
import { loadCostData } from "@/lib/ownerCostsServer";
import type { Signal } from "@/lib/ownerCosts";
import { cn } from "@/lib/cn";
import { RatesForm } from "./rates-form";
import { SyncAllButton } from "../owner-controls";

export const metadata = { title: "Costs & capacity" };

const aed = (n: number) => `${n < 0 ? "− " : ""}AED ${Math.abs(n).toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
const DOT = { ok: "bg-[var(--success)]", warn: "bg-[var(--warning)]", bad: "bg-[var(--error)]" } as const;

function Cell({ s }: { s: Signal | null | undefined }) {
  if (!s) return <span className="text-muted">Not read yet</span>;
  return <span className="inline-flex items-center gap-2"><span className={cn("h-2.5 w-2.5 rounded-full", DOT[s.level])} aria-hidden /><span className="tabular text-secondary">{s.text}</span><span className="sr-only">{s.level === "ok" ? "fine" : s.level === "warn" ? "watch" : "act now"}</span></span>;
}

export default async function CostsPage() {
  await requireOwner();
  const d = await loadCostData();
  const { report, rates } = d;
  const customers = d.watch.map((w) => ({ code: w.code, name: w.name }));
  return (
    <div className="space-y-6">
      <Link href="/owner" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-primary"><ArrowLeft className="h-4 w-4" aria-hidden />Customers</Link>
      <HeroHeader
        icon={Gauge}
        title="Costs & capacity"
        subtitle="What the platform really costs you this month, and the signs that something needs upgrading or topping up."
        pills={[
          { label: "Revenue", value: aed(report.revenueAed) },
          { label: "Costs", value: aed(report.totalAed) },
          { label: "Margin", value: aed(report.marginAed), warn: report.marginAed < 0 },
          { label: "Needs a look", value: String(d.flagged.length), warn: d.flagged.length > 0 },
        ]}
      />

      <div className="flex justify-end"><SyncAllButton /></div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="card p-4">
          <h2 className="mb-3 text-sm font-semibold text-primary">Where the money goes</h2>
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-muted uppercase"><tr><th className="py-2">Cost</th><th className="py-2">How we know</th><th className="py-2 text-right">This month</th></tr></thead>
            <tbody className="divide-y divide-[var(--border)]">
              {report.lines.map((l) => (
                <tr key={l.label}><td className="py-2 text-primary">{l.label}</td><td className="py-2"><span className={cn("rounded-full px-2 py-0.5 text-xs font-medium", l.live ? "bg-[var(--success-soft)] text-[var(--success)]" : "bg-[var(--warning-soft)] text-[var(--warning)]")}>{l.live ? "Live from tokens" : "Your rate"}</span></td><td className="tabular py-2 text-right">{aed(l.aed)}</td></tr>
              ))}
              <tr className="font-semibold"><td className="py-2">Total</td><td /><td className="tabular py-2 text-right">{aed(report.totalAed)}</td></tr>
            </tbody>
          </table>
          <p className="mt-3 text-xs text-muted">Claude: {Math.round(d.tokens).toLocaleString("en-US")} tokens this month. Customers were given {aed(Math.round(d.creditsGivenAed * 100) / 100)} of AI credits at your credit rate. Shared costs (the Supabase plan, Vercel, email, the website) are split equally between customers.</p>
        </section>

        <section className="card p-4">
          <h2 className="mb-3 text-sm font-semibold text-primary">Per customer: what each one leaves you</h2>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[30rem] text-sm">
              <thead className="text-left text-xs text-muted uppercase"><tr><th className="py-2">Customer</th><th className="py-2 text-right">Revenue</th><th className="py-2 text-right">Claude</th><th className="py-2 text-right">Database</th><th className="py-2 text-right">Shared</th><th className="py-2 text-right">Margin</th></tr></thead>
              <tbody className="divide-y divide-[var(--border)]">
                {report.perCustomer.map((p) => (
                  <tr key={p.code}><td className="py-2 text-primary">{p.name}{p.revenueAed === 0 && <span className="block text-xs text-[var(--warning)]">No price set</span>}</td><td className="tabular py-2 text-right">{aed(p.revenueAed)}</td><td className="tabular py-2 text-right">{aed(p.claudeAed)}</td><td className="tabular py-2 text-right">{aed(p.computeAed)}</td><td className="tabular py-2 text-right">{aed(p.shareAed)}</td><td className={cn("tabular py-2 text-right font-medium", p.marginAed < 0 ? "text-[var(--error)]" : "text-[var(--success)]")}>{aed(p.marginAed)}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      <section className="card p-4">
        <h2 className="mb-3 text-sm font-semibold text-primary">Watch list: do we need to upgrade or top up?</h2>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[48rem] text-sm">
            <thead className="text-left text-xs text-muted uppercase"><tr><th className="py-2">Where</th><th className="py-2">Database size</th><th className="py-2">Connections now</th><th className="py-2">AI credits</th><th className="py-2">Claude spend</th></tr></thead>
            <tbody className="divide-y divide-[var(--border)]">
              {d.watch.map((w) => (
                <tr key={w.code}><td className="py-2 text-primary">{w.name}</td><td className="py-2"><Cell s={w.signals.database} /></td><td className="py-2"><Cell s={w.signals.connections} /></td><td className="py-2"><Cell s={w.signals.aiCredits} /></td><td className="py-2"><Cell s={w.signals.claudeSpend} /></td></tr>
              ))}
              <tr><td className="py-2 text-primary">Main website</td><td className="py-2"><Cell s={d.mainSignals.database} /></td><td className="py-2"><Cell s={d.mainSignals.connections} /></td><td className="py-2 text-muted">n/a</td><td className="py-2 text-muted">n/a</td></tr>
              <tr><td className="py-2 text-primary">Email, all apps</td><td colSpan={4} className="py-2"><Cell s={d.email} /></td></tr>
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-xs text-muted">Amber means look soon (database over 70% of its disk, connections over 70%, AI credits under 20% left, Claude spend over 60% of what they pay, email over 80% of the plan). Red is worse. A figure that says "Not read yet" appears once you press Refresh usage and the customer's app is on the latest version. Supabase CPU and memory, and Vercel usage, aren't read yet: they need an access key from each service.</p>
      </section>

      <section className="card p-4">
        <h2 className="mb-1 text-sm font-semibold text-primary">Your rates</h2>
        <p className="mb-3 text-xs text-muted">These start from the usual prices. Check them against your invoices and change anything that differs; every figure above is recalculated from them.</p>
        <RatesForm rates={rates} customers={customers} />
      </section>
    </div>
  );
}
