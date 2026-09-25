"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, CheckCheck, ChevronRight, ExternalLink, Inbox, X } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/Dialog";
import { Badge, type BadgeColor } from "@/components/Badge";
import { Checkbox } from "@/components/ui/Checkbox";
import { cn } from "@/lib/cn";
import type { ApprovalItem, Chip } from "@/lib/approvals";
import { decideApprovalAction } from "./actions";
import { NumberInput } from "@/components/ui/NumberInput";
import { Select } from "@/components/ui/Select";

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
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [bulkMsg, setBulkMsg] = useState<string | null>(null);

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
  const active = visible.find((i) => i.key === activeKey) ?? visible[0] ?? null;
  const total = visible.reduce((n, i) => n + (i.amount ?? 0), 0);
  const oldest = visible.reduce((n, i) => Math.max(n, i.ageDays), 0);
  // Bulk approval is offered only for items that need no confirmation dialog.
  const bulkable = visible.filter((i) => checked.has(i.key) && !i.confirmApprove);

  function move(delta: number) {
    if (visible.length === 0) return;
    const idx = Math.max(0, visible.findIndex((i) => i.key === active?.key));
    setActiveKey(visible[(idx + delta + visible.length) % visible.length].key);
  }

  function bulkApprove() {
    setBulkMsg(null);
    start(async () => {
      let ok = 0;
      const failed: string[] = [];
      for (const i of bulkable) {
        const r = await decideApprovalAction({ kind: i.kind, id: i.id, ids: i.ids, field: i.field, decision: "APPROVE" });
        if (r.error) failed.push(`${i.title}: ${r.error}`);
        else {
          ok++;
          setDone((d) => new Set(d).add(i.key));
        }
      }
      setChecked(new Set());
      setBulkMsg(failed.length ? `${ok} approved. ${failed.length} couldn't be approved — ${failed[0]}` : `${ok} approved.`);
      router.refresh();
    });
  }

  return (
    <div className="space-y-4" onKeyDown={(e) => { const t = e.target as HTMLElement; if (["INPUT", "SELECT", "TEXTAREA"].includes(t.tagName)) return; if (e.key === "j") move(1); if (e.key === "k") move(-1); }}>
      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        {[
          { l: "Waiting for a decision", v: String(visible.length), sub: filters.type || filters.q ? "in this view" : "across all modules" },
          { l: "Value waiting", v: total > 0 ? `AED ${total.toLocaleString("en-AE", { maximumFractionDigits: 0 })}` : "—", sub: "expenses, bills and payroll" },
          { l: "Longest wait", v: visible.length ? age(oldest) : "—", sub: oldest >= 7 ? "needs attention" : "within target", warn: oldest >= 7 },
        ].map((t) => (
          <div key={t.l} className="card px-3 py-2.5 sm:px-4 sm:py-3">
            <p className="truncate text-[11px] font-medium text-muted sm:text-xs">{t.l}</p>
            <p className={cn("tabular mt-0.5 truncate text-base font-semibold tracking-tight sm:text-xl", t.warn ? "text-[var(--warning)]" : "text-primary")}>{t.v}</p>
            <p className="hidden text-xs text-subtle sm:block">{t.sub}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-1.5" role="tablist" aria-label="Kind of request">
        {tabs.map((t) => (
          <Link key={t.key || "all"} href={link({ type: t.key })} role="tab" aria-selected={filters.type === t.key}
            className={cn("rounded-full border px-3 py-1 text-sm transition", filters.type === t.key ? "border-[var(--brand-primary)] bg-brand-soft font-medium text-[var(--brand-primary)]" : "border-default text-secondary hover:bg-surface-hover")}>
            {t.label}{t.count > 0 && <span className="tabular ml-1.5 text-xs opacity-70">{t.count}</span>}
          </Link>
        ))}
      </div>

      <form method="get" action="/approvals" className="flex flex-wrap items-center gap-2">
        {filters.type && <input type="hidden" name="type" value={filters.type} />}
        <input name="q" defaultValue={filters.q} placeholder="Search supplier, person, amount…" aria-label="Search" className="input w-full max-w-xs" />
        <Select name="age" defaultValue={filters.age} searchable={false} options={[{ value: "", label: "Any wait" }, { value: "3", label: "3+ days" }, { value: "7", label: "7+ days" }, { value: "14", label: "14+ days" }, { value: "30", label: "30+ days" }]} />
        <NumberInput name="min" defaultValue={filters.min} min={0} placeholder="Min AED" ariaLabel="Amount from" className="w-28" />
        {requesters.length > 0 && <Select name="from" defaultValue={filters.from} options={[{ value: "", label: "Anyone" }, ...requesters.map((r) => ({ value: r, label: r }))]} />}
        <button type="submit" className="btn btn-secondary">Filter</button>
        {(filters.q || filters.age || filters.min || filters.from) && <Link href={link({ q: "", age: "", min: "", from: "" })} className="text-sm text-muted hover:text-primary">Clear</Link>}
      </form>

      {visible.length === 0 ? (
        <div className="empty-state flex flex-col items-center gap-2 py-14">
          <Inbox className="h-8 w-8 text-subtle" aria-hidden />
          <p className="text-sm font-medium text-primary">{totalShown === 0 && (filters.q || filters.age || filters.min || filters.from || filters.type) ? "Nothing matches those filters" : "You're all caught up"}</p>
          <p className="text-sm text-muted">{totalShown === 0 && (filters.q || filters.age || filters.min || filters.from || filters.type) ? "Try clearing a filter." : "New requests will appear here as they come in."}</p>
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,24rem)_minmax(0,1fr)]">
          <div className="card overflow-hidden">
            <div className="flex items-center justify-between gap-2 border-b border-default bg-surface-subtle px-3 py-2">
              <label className="flex items-center gap-2 text-xs text-muted">
                <Checkbox checked={visible.length > 0 && visible.every((i) => checked.has(i.key))} onCheckedChange={(c) => setChecked(c ? new Set(visible.map((i) => i.key)) : new Set())} ariaLabel="Select all" />
                {checked.size > 0 ? `${checked.size} selected` : "Select all"}
              </label>
              {bulkable.length > 0 && (
                <button type="button" className="btn btn-primary btn-sm gap-1.5" disabled={pending} onClick={bulkApprove}>
                  <CheckCheck className="h-3.5 w-3.5" aria-hidden />Approve {bulkable.length}
                </button>
              )}
            </div>
            {bulkMsg && <p role="status" className="border-b border-default px-3 py-2 text-xs text-secondary">{bulkMsg}</p>}
            <ul className="max-h-[70vh] divide-y divide-[var(--border)] overflow-y-auto">
              {visible.map((i) => {
                const isActive = active?.key === i.key;
                return (
                  <li key={i.key} className={cn("flex items-start gap-2.5 px-3 py-3 transition", isActive ? "bg-brand-soft" : "hover:bg-surface-hover")}>
                    <span className="pt-0.5"><Checkbox checked={checked.has(i.key)} onCheckedChange={(c) => setChecked((s) => { const n = new Set(s); if (c) n.add(i.key); else n.delete(i.key); return n; })} ariaLabel={`Select ${i.title}`} /></span>
                    <button type="button" onClick={() => setActiveKey(i.key)} aria-current={isActive} className="min-w-0 flex-1 text-left">
                      <span className="flex items-center gap-1.5">
                        <span className="rounded bg-[var(--surface-sunken)] px-1.5 py-0.5 text-[10px] font-medium tracking-wide text-muted uppercase">{KIND_LABEL[i.kind]}</span>
                        <span className={cn("text-[11px]", i.ageDays >= 14 ? "font-medium text-[var(--error)]" : i.ageDays >= 7 ? "text-[var(--warning)]" : "text-subtle")}>{age(i.ageDays)}</span>
                      </span>
                      <span className="mt-1 block truncate text-sm font-medium text-primary">{i.title}</span>
                      <span className="flex items-center justify-between gap-2 text-xs text-muted">
                        <span className="truncate">{i.requester ?? i.subtitle}</span>
                        {i.amount !== null && <span className="tabular shrink-0 font-medium text-secondary">AED {aed(i.amount)}</span>}
                      </span>
                    </button>
                    <ChevronRight className={cn("mt-1 hidden h-4 w-4 shrink-0 lg:block", isActive ? "text-[var(--brand-primary)]" : "text-subtle")} aria-hidden />
                  </li>
                );
              })}
            </ul>
          </div>

          {active && (
            <section className="card flex flex-col p-5 lg:sticky lg:top-20 lg:self-start" aria-label="Request detail">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded bg-[var(--surface-sunken)] px-1.5 py-0.5 text-[11px] font-medium tracking-wide text-muted uppercase">{KIND_LABEL[active.kind]}</span>
                {active.branch && <span className="text-xs text-subtle">{active.branch}</span>}
              </div>
              <h2 className="mt-2 text-lg font-semibold tracking-tight text-primary">{active.title}</h2>
              <p className="mt-1 text-sm text-secondary">{active.subtitle}</p>

              <dl className="mt-4 grid gap-3 sm:grid-cols-3">
                <div><dt className="text-xs text-muted">Requested by</dt><dd className="text-sm font-medium text-primary">{active.requester ?? "—"}</dd></div>
                <div><dt className="text-xs text-muted">Waiting</dt><dd className={cn("text-sm font-medium", active.ageDays >= 14 ? "text-[var(--error)]" : active.ageDays >= 7 ? "text-[var(--warning)]" : "text-primary")}>{age(active.ageDays)}</dd></div>
                <div><dt className="text-xs text-muted">Amount</dt><dd className="tabular text-sm font-semibold text-primary">{active.amount !== null ? `AED ${aed(active.amount)}` : "—"}</dd></div>
              </dl>

              {active.chips.length > 0 && (
                <div className="mt-4">
                  <p className="mb-1.5 text-xs font-medium text-muted">Things to check</p>
                  <div className="flex flex-wrap gap-1.5">{active.chips.map((c) => <Badge key={c.text} color={TONE[c.tone]} dot>{c.text}</Badge>)}</div>
                </div>
              )}
              {errors[active.key] && <p role="alert" className="mt-3 text-sm text-[var(--error)]">{errors[active.key]}</p>}

              <div className="mt-6 flex flex-wrap items-center gap-2 border-t border-default pt-4">
                <button type="button" className="btn btn-primary gap-1.5" disabled={pending}
                  onClick={() => { const i = active; if (i.confirmApprove && !confirm(i.kind === "CHANGE" ? "Bank details decide where payments go. Have you confirmed this change with the supplier?" : i.kind === "PAYROLL" ? `Approve this payroll of AED ${aed(i.amount ?? 0)}?` : `Approve all ${i.ids?.length ?? 1} timesheet rows?`)) return; decide(i, "APPROVE"); }}>
                  <Check className="h-4 w-4" aria-hidden />Approve
                </button>
                <button type="button" className="btn btn-secondary gap-1.5" disabled={pending} onClick={() => { setNote(""); setRejectError(null); setRejecting(active); }}>
                  <X className="h-4 w-4" aria-hidden />{active.kind === "PAYROLL" ? "Send back" : "Reject"}
                </button>
                <Link href={active.href} className="btn btn-secondary ml-auto gap-1.5"><ExternalLink className="h-3.5 w-3.5" aria-hidden />Open full record</Link>
              </div>
              <p className="mt-3 text-[11px] text-subtle">Tip: press J / K to move through the queue.</p>
            </section>
          )}
        </div>
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
