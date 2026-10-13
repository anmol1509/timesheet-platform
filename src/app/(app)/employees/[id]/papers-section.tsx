"use client";

import { useState, useTransition } from "react";
import { Check, ChevronDown, Minus, X } from "lucide-react";
import { Badge } from "@/components/Badge";
import { Select } from "@/components/ui/Select";
import { DatePicker } from "@/components/ui/DatePicker";
import { cn } from "@/lib/cn";
import { PAPERS, paperKind, pendingGateItems, type Paper, type PaperKind } from "@/lib/papers";
import { startPapersAction, updatePaperAction } from "./papers-actions";

export type PaperRowData = { item: string; status: string; statusDate: string; referenceNo: string; expiryDate: string; remarks: string };

const KIND_STYLE: Record<PaperKind, string> = {
  done: "bg-[var(--success-soft)] text-[var(--success-text,#067647)]",
  progress: "bg-[var(--warning-soft,#fef3c7)] text-[var(--warning-text,#92400e)]",
  pending: "bg-surface-subtle text-muted",
  issue: "bg-[var(--error-soft,#fee4e2)] text-[var(--error)]",
};
const KIND_ICON: Record<PaperKind, React.ReactNode> = {
  done: <Check className="h-3 w-3" />, progress: <span className="h-1.5 w-1.5 rounded-full bg-current" />, pending: <Minus className="h-3 w-3" />, issue: <X className="h-3 w-3" />,
};
const NO_EXPIRY = new Set(["TAWJEEH", "EID_BIOMETRICS"]);
const dmy = (iso: string) => (iso ? iso.split("-").reverse().join("-") : "");
const lbl = "mb-1 block text-xs font-medium text-muted";

function PaperRow({ employeeId, paper, row, canEdit }: { employeeId: string; paper: Paper; row: PaperRowData; canEdit: boolean }) {
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState(row.status);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const kind = paperKind(paper, row.status);

  function save(fd: FormData) {
    fd.set("employeeId", employeeId);
    fd.set("item", paper.key);
    fd.set("status", status);
    setError(null);
    start(async () => {
      const res = await updatePaperAction(fd);
      if (res.error) setError(res.error);
      else setOpen(false);
    });
  }

  return (
    <div className="border-b border-default last:border-0">
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className="flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-surface-hover">
        <span className={cn("inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full", KIND_STYLE[kind])} aria-hidden>{KIND_ICON[kind]}</span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-medium text-primary">{paper.label}{paper.gate && <span className="ml-1.5 text-[10px] font-normal text-subtle uppercase">needed</span>}</span>
          <span className="block truncate text-xs text-muted">
            {row.status}{row.statusDate ? ` · ${dmy(row.statusDate)}` : ""}{row.referenceNo ? ` · ${row.referenceNo}` : ""}{row.expiryDate ? ` · expires ${dmy(row.expiryDate)}` : ""}
          </span>
        </span>
        <ChevronDown className={cn("h-4 w-4 shrink-0 text-subtle transition-transform", open && "rotate-180")} aria-hidden />
      </button>
      {open && (
        <form action={save} className="grid gap-3 border-t border-default bg-surface-subtle px-4 py-3 sm:grid-cols-4">
          <label className="block"><span className={lbl}>Status</span><Select value={status} onChange={setStatus} searchable={false} disabled={!canEdit} options={paper.statuses.map((s) => ({ value: s.value, label: s.value }))} /></label>
          <label className="block"><span className={lbl}>Date</span><DatePicker name="statusDate" defaultValue={row.statusDate} disabled={!canEdit} className="w-full" /></label>
          <label className="block"><span className={lbl}>{paper.referenceLabel}</span><input name="referenceNo" defaultValue={row.referenceNo} disabled={!canEdit} className="input w-full" /></label>
          {!NO_EXPIRY.has(paper.key) && <label className="block"><span className={lbl}>Expiry</span><DatePicker name="expiryDate" defaultValue={row.expiryDate} disabled={!canEdit} className="w-full" /></label>}
          <label className="block sm:col-span-4"><span className={lbl}>Remarks</span><input name="remarks" defaultValue={row.remarks} disabled={!canEdit} className="input w-full" /></label>
          {error && <p role="alert" className="text-sm text-[var(--error)] sm:col-span-4">{error}</p>}
          {canEdit && (
            <div className="sm:col-span-4">
              <button type="submit" className="btn btn-primary" disabled={pending}>{pending ? "Saving…" : "Save"}</button>
            </div>
          )}
        </form>
      )}
    </div>
  );
}

/** The papers that follow arrival, with what is still holding up "papers pending". */
export function PapersSection({ employeeId, rows, canEdit, pendingFlag }: { employeeId: string; rows: PaperRowData[]; canEdit: boolean; pendingFlag: boolean }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (rows.length === 0) {
    return (
      <section>
        <h2 className="mb-3 text-sm font-semibold text-primary">Arrival papers</h2>
        <div className="card flex flex-wrap items-center justify-between gap-3 p-5">
          <p className="max-w-xl text-sm text-muted">Track the papers that follow arrival: medical, Tawjeeh, ILOE, health insurance, Emirates ID biometrics, visa stamping and the labour card. The worker shows as &ldquo;papers pending&rdquo; until the medical, visa and labour card are done.</p>
          {canEdit && <button type="button" className="btn btn-secondary" disabled={pending} onClick={() => start(async () => { const fd = new FormData(); fd.set("employeeId", employeeId); const r = await startPapersAction(fd).catch(() => ({ error: "Couldn't start the checklist." })); if (r?.error) setError(r.error); })}>{pending ? "Starting…" : "Start the checklist"}</button>}
          {error && <p role="alert" className="w-full text-sm text-[var(--error)]">{error}</p>}
        </div>
      </section>
    );
  }

  const byItem = new Map(rows.map((r) => [r.item, r]));
  const outstanding = pendingGateItems(rows.map((r) => ({ item: r.item, status: r.status })));
  return (
    <section>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <h2 className="text-sm font-semibold text-primary">Arrival papers</h2>
        {pendingFlag ? <Badge color="amber">Papers pending</Badge> : <Badge color="green">Papers complete</Badge>}
      </div>
      {pendingFlag && outstanding.length > 0 && <p className="mb-2 text-xs text-muted">Still needed: {outstanding.map((p) => p.label.toLowerCase()).join(", ")}.</p>}
      <div className="card overflow-hidden">
        {PAPERS.map((p) => (
          <PaperRow key={p.key} employeeId={employeeId} paper={p} canEdit={canEdit} row={byItem.get(p.key) ?? { item: p.key, status: "Pending", statusDate: "", referenceNo: "", expiryDate: "", remarks: "" }} />
        ))}
      </div>
    </section>
  );
}
