"use client";

import { useState, useTransition } from "react";
import { CheckCheck, Download, FileText, RotateCcw, Trash2, Undo2 } from "lucide-react";
import Link from "next/link";
import { deleteRunAction, markPaidAction, recomputeRunAction, reopenRunAction, saveLineAction, submitRunAction } from "../actions";
import { NumberInput } from "@/components/ui/NumberInput";

type State = { error: string | null; ok?: boolean };

export function RunControls({
  id,
  status,
  submitted,
  canEdit,
  canApprove,
  canExport,
  canDelete,
}: {
  id: string;
  status: string;
  /** A draft that has been sent to the Approvals inbox. */
  submitted: boolean;
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
        {status === "DRAFT" && !submitted && canEdit && (
          <button type="button" className="btn btn-secondary" disabled={pending} onClick={() => run(recomputeRunAction)}>
            <RotateCcw className="h-4 w-4" aria-hidden /> Recalculate
          </button>
        )}
        {status === "DRAFT" && !submitted && canEdit && (
          <button type="button" className="btn btn-primary" disabled={pending} onClick={() => run(submitRunAction)}>
            <CheckCheck className="h-4 w-4" aria-hidden /> Submit for approval
          </button>
        )}
        {status === "DRAFT" && submitted && (
          <Link href="/approvals?type=PAYROLL" className="btn btn-secondary">Awaiting approval — open in Approvals</Link>
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

type ChangeHandler = (e: React.ChangeEvent<HTMLInputElement>) => void;

/** One labelled amount + note pair. Defined at module level so it isn't remounted on every keystroke. */
function LineRow({ label, amount, note, onAmount, onNote, placeholder }: { label: string; amount: string; note: string; onAmount: ChangeHandler; onNote: ChangeHandler; placeholder: string }) {
  return (
    <div className="grid grid-cols-[4.5rem_5.5rem_1fr] items-center gap-1.5">
      <span className="text-xs text-muted">{label}</span>
      <NumberInput step={0.01} value={amount} onChange={(v) => onAmount({ target: { value: String(v) } } as React.ChangeEvent<HTMLInputElement>)} ariaLabel={`${label} (AED)`} inputClassName="h-8 text-right tabular-nums" />
      <input value={note} onChange={onNote} placeholder={placeholder} aria-label={`${label} note`} className="input h-8 text-xs" />
    </div>
  );
}

/**
 * Editor for the three things typed against a line: a deduction (a fine,
 * damage...), the advance recovered this month, and an adjustment (+ or −).
 * Each has its own note. One Save writes all three and recomputes net pay.
 */
export function LineEditor({
  lineId, deduction, deductionNote, advance, advanceNote, adjustment, adjustmentNote, disabled,
}: {
  lineId: string; deduction: number; deductionNote: string; advance: number; advanceNote: string; adjustment: number; adjustmentNote: string; disabled: boolean;
}) {
  const [pending, start] = useTransition();
  const [v, setV] = useState({ deduction: String(deduction || ""), deductionNote, advance: String(advance || ""), advanceNote, adjustment: String(adjustment || ""), adjustmentNote });
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const dirty =
    Number(v.deduction || 0) !== deduction || v.deductionNote !== deductionNote || Number(v.advance || 0) !== advance || v.advanceNote !== advanceNote ||
    Number(v.adjustment || 0) !== adjustment || v.adjustmentNote !== adjustmentNote;
  const set = (k: keyof typeof v) => (e: React.ChangeEvent<HTMLInputElement>) => { setSaved(false); setV((p) => ({ ...p, [k]: e.target.value })); };

  function save() {
    setError(null);
    start(async () => {
      const fd = new FormData();
      fd.set("lineId", lineId);
      for (const [k, val] of Object.entries(v)) fd.set(k, val);
      const res = await saveLineAction(fd);
      if (res.error) setError(res.error); else setSaved(true);
    });
  }

  if (disabled) {
    const rows = [
      ["Deduction", deduction, deductionNote, "−"],
      ["Advance", advance, advanceNote, "−"],
      ["Adjustment", adjustment, adjustmentNote, adjustment < 0 ? "−" : "+"],
    ] as const;
    return (
      <ul className="min-w-44 space-y-1 text-xs">
        {rows.filter(([, a]) => a !== 0).map(([label, a, note, sign]) => (
          <li key={label}><span className="text-muted">{label}:</span> <span className="tabular text-secondary">{sign}{Math.abs(a).toFixed(2)}</span>{note && <span className="block max-w-56 truncate text-subtle" title={note}>{note}</span>}</li>
        ))}
        {deduction === 0 && advance === 0 && adjustment === 0 && <li className="text-subtle">—</li>}
      </ul>
    );
  }
  return (
    <div className="flex min-w-[24rem] flex-col gap-1.5">
      <LineRow label="Deduction" amount={v.deduction} note={v.deductionNote} onAmount={set("deduction")} onNote={set("deductionNote")} placeholder="What for? (fine, damage…)" />
      <LineRow label="Advance" amount={v.advance} note={v.advanceNote} onAmount={set("advance")} onNote={set("advanceNote")} placeholder="Note (advance taken on…)" />
      <LineRow label="Adjustment" amount={v.adjustment} note={v.adjustmentNote} onAmount={set("adjustment")} onNote={set("adjustmentNote")} placeholder="Bonus / correction (− to deduct)" />
      <div className="flex items-center gap-2">
        {dirty && <button type="button" className="btn btn-primary h-7 px-3 text-xs" disabled={pending} onClick={save}>{pending ? "Saving…" : "Save"}</button>}
        {saved && !dirty && <span className="text-xs text-[var(--success)]">Saved</span>}
        {error && <p role="alert" className="text-xs text-[var(--error)]">{error}</p>}
      </div>
    </div>
  );
}
