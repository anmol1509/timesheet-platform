"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { Badge } from "@/components/Badge";
import { cn } from "@/lib/cn";

export type ClientRow = {
  id: string;
  name: string;
  employeeCount: number;
  totalHours: number;
  billRateSet: boolean;
  unratedTrades: string[];
  amount: number;
  margin: number;
  /** An invoice for this client and month already exists. */
  invoiced: boolean;
};

type Chip = "all" | "ready" | "norate" | "invoiced";
const aed = (n: number) => `AED ${n.toLocaleString("en-AE", { maximumFractionDigits: 2 })}`;
const stateOf = (c: ClientRow): Exclude<Chip, "all"> => (c.invoiced ? "invoiced" : c.billRateSet ? "ready" : "norate");

/** One row per client for the month: what can be billed, what is blocked, what is already done. */
export function InvoiceGrid({ clients, month }: { clients: ClientRow[]; month: string }) {
  const [query, setQuery] = useState("");
  const [chip, setChip] = useState<Chip>("all");
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return clients.filter((c) => (chip === "all" || stateOf(c) === chip) && (!q || c.name.toLowerCase().includes(q)));
  }, [clients, query, chip]);
  const count = (c: Chip) => clients.filter((x) => c === "all" || stateOf(x) === c).length;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <label className="relative min-w-[14rem] flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-subtle" aria-hidden />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search client…" aria-label="Search clients" className="input w-full pl-9" />
        </label>
        {([["all", "All"], ["ready", "Ready"], ["norate", "No rate"], ["invoiced", "Invoiced"]] as const).map(([key, label]) => (
          <button key={key} type="button" onClick={() => setChip(key)} className={cn("rounded-control border px-3 py-1.5 text-xs font-medium transition", chip === key ? "border-[var(--brand-primary)] bg-brand-soft text-[var(--brand-primary)]" : "border-default bg-surface text-secondary hover:bg-surface-hover")}>{label} ({count(key)})</button>
        ))}
      </div>
      <div className="card overflow-x-auto">
        <table className="w-full min-w-[44rem] text-sm">
          <thead className="border-b border-default bg-surface-subtle text-left text-xs font-medium tracking-wide text-muted uppercase">
            <tr><th className="px-4 py-3">Client</th><th className="px-4 py-3">Timesheet</th><th className="px-4 py-3 text-right">Amount</th><th className="px-4 py-3 text-right">Margin</th><th className="px-4 py-3">Status</th><th className="w-32 px-4 py-3" /></tr>
          </thead>
          <tbody className="divide-y divide-[var(--border)]">
            {filtered.map((c) => {
              const st = stateOf(c);
              return (
                <tr key={c.id} className="hover:bg-surface-hover">
                  <td className="px-4 py-3 font-medium text-primary">{c.name}</td>
                  <td className="px-4 py-3 text-secondary">{c.employeeCount} {c.employeeCount === 1 ? "worker" : "workers"} · {c.totalHours.toFixed(1)} h</td>
                  <td className="tabular px-4 py-3 text-right font-medium text-primary">{aed(c.amount)}</td>
                  <td className={cn("tabular px-4 py-3 text-right", c.margin >= 0 ? "text-[var(--success)]" : "text-[var(--error)]")}>{aed(c.margin)}</td>
                  <td className="px-4 py-3">
                    {st === "ready" && <Badge color="green">Ready</Badge>}
                    {st === "invoiced" && <Badge color="blue">Invoiced</Badge>}
                    {st === "norate" && <><Badge color="amber">No rate</Badge><span className="ml-2 text-xs text-[var(--warning)]">{c.unratedTrades.join(", ")}</span></>}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link href={`/invoices/${c.id}/generate?month=${month}`} className={cn("btn btn-sm", st === "ready" ? "btn-primary" : "btn-secondary")}>{st === "invoiced" ? "View" : "Review"}</Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {filtered.length === 0 && <p className="px-4 py-10 text-center text-sm text-muted">No clients match.</p>}
      </div>
    </div>
  );
}
