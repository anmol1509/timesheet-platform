"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { Plus, Search, TriangleAlert } from "lucide-react";
import { Badge, type BadgeColor } from "@/components/Badge";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/Dialog";
import { cn } from "@/lib/cn";
import { createRunAction } from "./actions";

export type RunRow = {
  key: string;
  /** Null for a month that has not been started for this company yet. */
  id: string | null;
  month: string;
  monthLabel: string;
  companyId: string | null;
  company: string;
  status: "NOT_STARTED" | "DRAFT" | "SUBMITTED" | "APPROVED" | "PAID";
  due: string | null;
  overdueDays: number;
  people: number;
  net: number;
};

const STATUS: Record<RunRow["status"], { label: string; color: BadgeColor }> = {
  NOT_STARTED: { label: "Not started", color: "slate" },
  DRAFT: { label: "Draft", color: "amber" },
  SUBMITTED: { label: "Waiting for approval", color: "amber" },
  APPROVED: { label: "Approved · to pay", color: "blue" },
  PAID: { label: "Paid", color: "green" },
};
const aed = (n: number) => n.toLocaleString("en-AE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
type Chip = "all" | "todo" | "paid";

/** Pay runs first: what needs doing, one row per company and month, with the button that does it. */
export function PayRuns({ rows, canCreate }: { rows: RunRow[]; canCreate: boolean }) {
  const [query, setQuery] = useState("");
  const [chip, setChip] = useState<Chip>("all");
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const todo = (r: RunRow) => r.status !== "PAID";
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((r) => (chip === "all" || (chip === "todo" ? todo(r) : !todo(r))) && (!q || `${r.company} ${r.month} ${r.monthLabel}`.toLowerCase().includes(q)));
  }, [rows, query, chip]);
  const count = (c: Chip) => rows.filter((r) => c === "all" || (c === "todo" ? todo(r) : !todo(r))).length;

  function startRun(r: RunRow) {
    if (!r.companyId) return;
    setError(null);
    const fd = new FormData();
    fd.append("companyId", r.companyId);
    fd.append("month", r.month);
    start(async () => {
      const res = await createRunAction({ error: null }, fd);
      if (res?.error) setError(res.error);
    });
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <label className="relative min-w-[14rem] flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-subtle" aria-hidden />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search company or month…" aria-label="Search pay runs" className="input w-full pl-9" />
        </label>
        {([["all", "All"], ["todo", "To do"], ["paid", "Paid"]] as const).map(([key, label]) => (
          <button key={key} type="button" onClick={() => setChip(key)} className={cn("rounded-control border px-3 py-1.5 text-xs font-medium transition", chip === key ? "border-[var(--brand-primary)] bg-brand-soft text-[var(--brand-primary)]" : "border-default bg-surface text-secondary hover:bg-surface-hover")}>{label} ({count(key)})</button>
        ))}
      </div>
      {error && <p role="alert" className="text-sm text-[var(--error)]">{error}</p>}
      <div className="card overflow-x-auto">
        <table className="w-full min-w-[40rem] text-sm">
          <thead className="border-b border-default bg-surface-subtle text-left text-xs font-medium tracking-wide text-muted uppercase">
            <tr><th className="px-4 py-3">Month</th><th className="px-4 py-3">Company</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Due</th><th className="px-4 py-3 text-right">People</th><th className="px-4 py-3 text-right">Total net (AED)</th><th className="w-28 px-4 py-3" /></tr>
          </thead>
          <tbody className="divide-y divide-[var(--border)]">
            {shown.map((r) => {
              const st = STATUS[r.status];
              return (
                <tr key={r.key} className="hover:bg-surface-hover">
                  <td className="px-4 py-3 font-medium text-primary">{r.monthLabel}</td>
                  <td className="px-4 py-3 text-secondary">{r.company}</td>
                  <td className="px-4 py-3"><Badge color={st.color} dot>{st.label}</Badge></td>
                  <td className="px-4 py-3 text-xs text-secondary">{r.due ?? <span className="text-subtle">—</span>}{r.status !== "PAID" && r.overdueDays > 0 && <Badge color="red" className="ml-2">{r.overdueDays}d late</Badge>}</td>
                  <td className="tabular px-4 py-3 text-right text-secondary">{r.id ? r.people : "—"}</td>
                  <td className="tabular px-4 py-3 text-right text-primary">{r.id ? aed(r.net) : "—"}</td>
                  <td className="px-4 py-3 text-right">
                    {r.id ? (
                      <Link href={`/payroll/${r.id}`} className={cn("btn btn-sm", r.status === "APPROVED" || r.status === "SUBMITTED" ? "btn-primary" : "btn-secondary")}>Open</Link>
                    ) : canCreate ? (
                      <button type="button" disabled={pending} onClick={() => startRun(r)} className="btn btn-primary btn-sm">{pending ? "Starting…" : "Start run"}</button>
                    ) : null}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {shown.length === 0 && <p className="px-4 py-10 text-center text-sm text-muted">{rows.length === 0 ? "No payroll runs yet. Press “Start a payroll run” at the top." : "Nothing matches."}</p>}
      </div>
    </div>
  );
}

/** A dialog opened from a header button, with whatever form or table the page puts inside it. */
export function HeaderDialog({ label, title, description, primary, icon, children, wide }: { label: string; title: string; description?: string; primary?: boolean; icon?: boolean; children: React.ReactNode; wide?: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button type="button" className={cn("btn btn-sm gap-1.5", primary ? "btn-primary" : "btn-secondary")}>{icon && <Plus className="h-3.5 w-3.5" aria-hidden />}{label}</button>
      </DialogTrigger>
      {open && <DialogContent title={title} description={description} className={wide ? "max-w-3xl" : "max-w-xl"}><div className="mt-4 max-h-[70vh] overflow-y-auto pr-1">{children}</div></DialogContent>}
    </Dialog>
  );
}

/** One line instead of the whole checklist while setup is unfinished; "Finish setup" opens the checklist. */
export function SetupBanner({ remaining, summary, children }: { remaining: number; summary: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div role="status" className="flex flex-wrap items-center gap-3 rounded-card border border-[var(--warning-border,var(--border))] bg-[var(--warning-soft)] px-4 py-3 text-sm">
      <TriangleAlert className="h-5 w-5 shrink-0 text-[var(--warning)]" aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="font-semibold text-primary">{remaining} setup step{remaining === 1 ? "" : "s"} left before payroll works end to end</p>
        <p className="text-muted">{summary}</p>
      </div>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild><button type="button" className="btn btn-secondary btn-sm">Finish setup</button></DialogTrigger>
        {open && <DialogContent title="Set up payroll" description="Do these in order. Each takes a minute or two." className="max-w-3xl"><div className="mt-4 max-h-[70vh] overflow-y-auto pr-1">{children}</div></DialogContent>}
      </Dialog>
    </div>
  );
}
