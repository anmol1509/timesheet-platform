"use client";

import { useState, useTransition } from "react";
import { CheckCheck, Download, FileText, RotateCcw, Trash2, Undo2 } from "lucide-react";
import { approveRunAction, deleteRunAction, markPaidAction, recomputeRunAction, reopenRunAction, saveAdjustmentAction } from "../actions";

type State = { error: string | null; ok?: boolean };

export function RunControls({
  id,
  status,
  canEdit,
  canApprove,
  canExport,
  canDelete,
}: {
  id: string;
  status: string;
  canEdit: boolean;
  canApprove: boolean;
  canExport: boolean;
  canDelete: boolean;
}) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const run = (fn: (fd: FormData) => Promise<State | void>) =>
    start(async () => {
      setError(null);
      const fd = new FormData();
      fd.set("id", id);
      const res = await fn(fd);
      if (res && res.error) setError(res.error);
    });

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {status === "DRAFT" && canEdit && (
          <button type="button" className="btn btn-secondary" disabled={pending} onClick={() => run(recomputeRunAction)}>
            <RotateCcw className="h-4 w-4" aria-hidden /> Recalculate
          </button>
        )}
        {status === "DRAFT" && canApprove && (
          <button type="button" className="btn btn-primary" disabled={pending} onClick={() => run(approveRunAction)}>
            <CheckCheck className="h-4 w-4" aria-hidden /> Approve run
          </button>
        )}
        {status === "APPROVED" && canApprove && (
          <>
            <button type="button" className="btn btn-primary" disabled={pending} onClick={() => run(markPaidAction)}>
              <CheckCheck className="h-4 w-4" aria-hidden /> Mark as paid
            </button>
            <button type="button" className="btn btn-secondary" disabled={pending} onClick={() => run(reopenRunAction)}>
              <Undo2 className="h-4 w-4" aria-hidden /> Reopen
            </button>
          </>
        )}
        {status !== "DRAFT" && canExport && (
          <a className="btn btn-secondary" href={`/api/payroll/${id}/sif`}>
            <Download className="h-4 w-4" aria-hidden /> WPS file (.SIF)
          </a>
        )}
        {canExport && (
          <a className="btn btn-secondary" href={`/api/payroll/${id}/csv`}>
            <Download className="h-4 w-4" aria-hidden /> CSV
          </a>
        )}
        <a className="btn btn-secondary" href={`/payroll/${id}/payslips`} target="_blank" rel="noreferrer">
          <FileText className="h-4 w-4" aria-hidden /> Payslips
        </a>
        {status === "DRAFT" && canDelete && (
          <button type="button" className="btn btn-secondary" disabled={pending} onClick={() => run(deleteRunAction as unknown as (fd: FormData) => Promise<void>)}>
            <Trash2 className="h-4 w-4" aria-hidden /> Delete draft
          </button>
        )}
      </div>
      {error && <p role="alert" className="text-sm text-[var(--danger-text,#b42318)]">{error}</p>}
    </div>
  );
}

/** Inline adjustment editor for one line (draft runs only). */
export function AdjustmentCell({ lineId, adjustment, note, disabled }: { lineId: string; adjustment: number; note: string; disabled: boolean }) {
  const [pending, start] = useTransition();
  const [value, setValue] = useState(String(adjustment));
  const [text, setText] = useState(note);
  const [error, setError] = useState<string | null>(null);
  const dirty = Number(value || 0) !== adjustment || text !== note;

  function save() {
    setError(null);
    start(async () => {
      const fd = new FormData();
      fd.set("lineId", lineId);
      fd.set("adjustment", value);
      fd.set("note", text);
      const res = await saveAdjustmentAction(fd);
      if (res.error) setError(res.error);
    });
  }

  if (disabled) {
    return (
      <span className="text-secondary">
        {adjustment !== 0 ? adjustment.toFixed(2) : "—"}
        {note && <span className="block max-w-40 truncate text-xs text-muted" title={note}>{note}</span>}
      </span>
    );
  }
  return (
    <div className="flex min-w-44 flex-col gap-1">
      <div className="flex gap-1">
        <input type="number" step="0.01" value={value} onChange={(e) => setValue(e.target.value)} aria-label="Adjustment (AED)" className="input w-24 text-right tabular-nums" />
        {dirty && <button type="button" className="btn btn-primary" disabled={pending} onClick={save}>{pending ? "…" : "Save"}</button>}
      </div>
      <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Reason (bonus, advance…)" aria-label="Adjustment reason" className="input w-full text-xs" />
      {error && <p role="alert" className="text-xs text-[var(--danger-text,#b42318)]">{error}</p>}
    </div>
  );
}
