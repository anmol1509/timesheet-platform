"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, ExternalLink, X } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/Dialog";
import { Badge, type BadgeColor } from "@/components/Badge";
import { cn } from "@/lib/cn";
import type { ApprovalItem, Chip } from "@/lib/approvals";
import { decideApprovalAction } from "./actions";

export type BoardItem = Omit<ApprovalItem, "at"> & { at: string; ageDays: number };
type Tab = { key: string; label: string; count: number };
type Filters = { type: string; q: string; age: string; min: string; from: string };

const KIND_LABEL: Record<string, string> = {
  EXPENSE: "Expense", BILL: "Supplier bill", PAYROLL: "Payroll", WORKER: "New worker", CHANGE: "Detail change", SUPPLIER: "Supplier", DEMAND: "Demand", TIMESHEET: "Timesheet", CORRECTION: "Attendance",
};
const TONE: Record<Chip["tone"], BadgeColor> = { warning: "amber", danger: "red", success: "green", info: "blue", neutral: "slate" };
const aed = (n: number) => n.toLocaleString("en-AE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const age = (d: number) => (d <= 0 ? "today" : d === 1 ? "1 day" : `${d} days`);

export function ApprovalsBoard({ items, tabs, filters, requesters, totalShown }: { items: BoardItem[]; tabs: Tab[]; filters: Filters; requesters: string[]; totalShown: number }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [done, setDone] = useState<Set<string>>(new Set());
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [rejecting, setRejecting] = useState<BoardItem | null>(null);
  const [note, setNote] = useState("");
  const [rejectError, setRejectError] = useState<string | null>(null);

  const link = (over: Partial<Filters>) => {
    const f = { ...filters, ...over };
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries(f)) if (v) p.set(k === "type" ? "type" : k, v);
    const s = p.toString();
    return s ? `/approvals?${s}` : "/approvals";
  };

  function decide(item: BoardItem, decision: "APPROVE" | "REJECT", reason?: string, after?: () => void) {
    start(async () => {
      setErrors((e) => ({ ...e, [item.key]: "" }));
      const r = await decideApprovalAction({ kind: item.kind, id: item.id, ids: item.ids, field: item.field, decision, note: reason });
      if (r.error) {
        if (decision === "REJECT") setRejectError(r.error); else setErrors((e) => ({ ...e, [item.key]: r.error! }));
        return;
      }
      setDone((d) => new Set(d).add(item.key));
      after?.();
      router.refresh();
    });
  }

  const visible = items.filter((i) => !done.has(i.key));
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Kind of request">
        {tabs.map((t) => (
          <Link key={t.key || "all"} href={link({ type: t.key })} role="tab" aria-selected={filters.type === t.key}
            className={cn("rounded-md px-3 py-1.5 text-sm transition", filters.type === t.key ? "bg-brand-soft font-medium text-[var(--brand-primary)]" : "text-secondary hover:bg-surface-hover")}>
            {t.label}{t.count > 0 && <span className={cn("ml-1.5 rounded-full px-1.5 text-xs", filters.type === t.key ? "bg-[var(--brand-primary)]/15" : "bg-[var(--surface-sunken)] text-muted")}>{t.count}</span>}
          </Link>
        ))}
      </div>

      <form method="get" action="/approvals" className="card flex flex-wrap items-end gap-3 p-4">
        {filters.type && <input type="hidden" name="type" value={filters.type} />}
        <label className="block min-w-48 flex-1"><span className="mb-1 block text-xs font-medium text-muted">Search</span><input name="q" defaultValue={filters.q} placeholder="Supplier, person, amount…" className="input w-full" /></label>
        <label className="block"><span className="mb-1 block text-xs font-medium text-muted">Waiting at least</span>
          <select name="age" defaultValue={filters.age} className="input"><option value="">Any time</option><option value="3">3 days</option><option value="7">7 days</option><option value="14">14 days</option><option value="30">30 days</option></select></label>
        <label className="block"><span className="mb-1 block text-xs font-medium text-muted">Amount from (AED)</span><input type="number" min="0" name="min" defaultValue={filters.min} className="input w-32" /></label>
        {requesters.length > 0 && <label className="block"><span className="mb-1 block text-xs font-medium text-muted">Requested by</span>
          <select name="from" defaultValue={filters.from} className="input"><option value="">Anyone</option>{requesters.map((r) => <option key={r} value={r}>{r}</option>)}</select></label>}
        <button type="submit" className="btn btn-secondary">Filter</button>
        {(filters.q || filters.age || filters.min || filters.from) && <Link href={link({ q: "", age: "", min: "", from: "" })} className="text-sm text-muted hover:text-primary">Clear</Link>}
      </form>

      {visible.length === 0 ? (
        <div className="empty-state"><p className="text-sm text-muted">{totalShown === 0 && (filters.q || filters.age || filters.min || filters.from || filters.type) ? "Nothing matches those filters." : "You're all caught up. Nothing is waiting for a decision."}</p></div>
      ) : (
        <ul className="card divide-y divide-[var(--border)] overflow-hidden">
          {visible.map((i) => (
            <li key={i.key} className="px-5 py-4">
              <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded bg-[var(--surface-sunken)] px-1.5 py-0.5 text-[11px] font-medium tracking-wide text-muted uppercase">{KIND_LABEL[i.kind]}</span>
                    {i.branch && <span className="text-[11px] text-subtle">{i.branch}</span>}
                    <p className="text-sm font-medium text-primary">{i.title}</p>
                  </div>
                  <p className="mt-1 text-xs text-muted">{i.subtitle}</p>
                  {i.chips.length > 0 && <div className="mt-2 flex flex-wrap gap-1.5">{i.chips.map((c) => <Badge key={c.text} color={TONE[c.tone]}>{c.text}</Badge>)}</div>}
                  {errors[i.key] && <p role="alert" className="mt-2 text-xs text-[var(--error)]">{errors[i.key]}</p>}
                </div>
                <div className="flex flex-col items-end gap-2">
                  <div className="text-right">
                    {i.amount !== null && <p className="tabular text-sm font-semibold text-primary">AED {aed(i.amount)}</p>}
                    <p className={cn("text-xs", i.ageDays >= 14 ? "font-medium text-[var(--error)]" : i.ageDays >= 7 ? "text-[var(--warning)]" : "text-subtle")}>Waiting {age(i.ageDays)}{i.requester ? ` · ${i.requester}` : ""}</p>
                  </div>
                  <div className="flex flex-wrap justify-end gap-1.5">
                    <Link href={i.href} className="btn btn-secondary gap-1.5"><ExternalLink className="h-3.5 w-3.5" aria-hidden />Open</Link>
                    <button type="button" className="btn btn-secondary" disabled={pending} onClick={() => { setNote(""); setRejectError(null); setRejecting(i); }}><X className="h-4 w-4" aria-hidden />{i.kind === "PAYROLL" ? "Send back" : "Reject"}</button>
                    <button type="button" className="btn btn-primary" disabled={pending}
                      onClick={() => { if (i.confirmApprove && !confirm(i.kind === "CHANGE" ? "Bank details decide where payments go. Have you confirmed this change with the supplier?" : i.kind === "PAYROLL" ? `Approve this payroll of AED ${aed(i.amount ?? 0)}?` : `Approve all ${i.ids?.length ?? 1} timesheet rows?`)) return; decide(i, "APPROVE"); }}>
                      <Check className="h-4 w-4" aria-hidden />Approve
                    </button>
                  </div>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      <Dialog open={rejecting !== null} onOpenChange={(o) => !o && setRejecting(null)}>
        {rejecting && (
          <DialogContent title={rejecting.kind === "PAYROLL" ? "Send this back?" : "Reject this request?"} description={rejecting.title}>
            <label className="mt-4 block">
              <span className="mb-1 block text-xs font-medium text-muted">{rejecting.rejectNeedsReason ? "Reason (the requester will see this) *" : "Reason (optional)"}</span>
              <input value={note} onChange={(e) => setNote(e.target.value)} className="input w-full" autoFocus />
            </label>
            {rejectError && <p role="alert" className="mt-2 text-sm text-[var(--error)]">{rejectError}</p>}
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" className="btn btn-secondary" onClick={() => setRejecting(null)}>Back</button>
              <button type="button" className="btn btn-primary" disabled={pending || (rejecting.rejectNeedsReason && !note.trim())} onClick={() => decide(rejecting, "REJECT", note, () => setRejecting(null))}>{rejecting.kind === "PAYROLL" ? "Send back" : "Reject"}</button>
            </div>
          </DialogContent>
        )}
      </Dialog>
    </div>
  );
}
