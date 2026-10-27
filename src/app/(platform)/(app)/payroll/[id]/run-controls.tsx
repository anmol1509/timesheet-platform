"use client";

import { ExportLink } from "@/components/ExportLink";
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
          <button type="button" className="btn btn-primary" disabled={pending} onClick={() => run(submitRunAction)}>
            <CheckCheck className="h-4 w-4" aria-hidden /> Submit for approval
          </button>
        )}
        {status === "DRAFT" && submitted && (
          <Link href="/approvals?type=PAYROLL" className="btn btn-secondary">Awaiting approval: open in Approvals</Link>
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
          <ExportLink className="btn btn-secondary" href={`/api/payroll/${id}/sif`} skipHref={`/api/payroll/${id}/sif?skip=1`} title="The salary file your bank needs (WPS / SIF). Upload it in your bank's online portal to pay everyone at once.">
            <Download className="h-4 w-4" aria-hidden /> Bank file (WPS)
          </ExportLink>
        )}
        {status !== "DRAFT" && canExport && (
          <ExportLink className="btn btn-secondary" href={`/api/payroll/${id}/c3`} title="The C3 salary-card file: everyone in this run who has a C3 ID, with their net pay.">
            <Download className="h-4 w-4" aria-hidden /> C3 file
          </ExportLink>
        )}
        {status !== "DRAFT" && canExport && (
          <ExportLink className="btn btn-secondary" href={`/api/payroll/${id}/wps-sheet`} title="The payroll sheet that goes with the bank file: company, MOL ID, then each worker's work permit, personal number, bank and pay.">
            <Download className="h-4 w-4" aria-hidden /> WPS payroll sheet
          </ExportLink>
        )}
        <a className="btn btn-secondary" href={`/payroll/${id}/payslips`} target="_blank" rel="noreferrer">
          <FileText className="h-4 w-4" aria-hidden /> Payslips
        </a>
        {((status === "DRAFT" && !submitted && canEdit) || canExport || (status === "DRAFT" && canDelete)) && (
          <details className="relative">
            <summary className="btn btn-secondary cursor-pointer list-none">More ▾</summary>
            <div className="absolute z-10 mt-1 flex min-w-48 flex-col gap-0.5 rounded-lg border border-default bg-surface p-1 shadow-lg">
              {status === "DRAFT" && !submitted && canEdit && (
                <button type="button" className="flex items-center gap-2 rounded px-3 py-2 text-left text-sm hover:bg-surface-hover" disabled={pending} onClick={() => run(recomputeRunAction)}>
                  <RotateCcw className="h-4 w-4" aria-hidden /> Recalculate from attendance
                </button>
              )}
              {canExport && (
                <ExportLink className="flex items-center gap-2 rounded px-3 py-2 text-sm hover:bg-surface-hover" href={`/api/payroll/${id}/csv`}>
                  <Download className="h-4 w-4" aria-hidden /> Download as spreadsheet (CSV)
                </ExportLink>
              )}
              {canExport && (
                <ExportLink className="flex items-center gap-2 rounded px-3 py-2 text-sm hover:bg-surface-hover" href={`/api/payroll/${id}/register`}>
                  <Download className="h-4 w-4" aria-hidden /> Payroll register (Excel)
                </ExportLink>
              )}
              {canExport && (
                <ExportLink className="flex items-center gap-2 rounded px-3 py-2 text-sm hover:bg-surface-hover" href={`/api/payroll/${id}/journal`}>
                  <Download className="h-4 w-4" aria-hidden /> Accounting journal (CSV)
                </ExportLink>
              )}
              {status === "DRAFT" && canDelete && (
                <button type="button" className="flex items-center gap-2 rounded px-3 py-2 text-left text-sm text-[var(--error)] hover:bg-surface-hover" disabled={pending} onClick={() => run(deleteRunAction as unknown as (fd: FormData) => Promise<void>)}>
                  <Trash2 className="h-4 w-4" aria-hidden /> Delete this draft
                </button>
              )}
            </div>
          </details>
        )}
      </div>
      {error && <p role="alert" className="text-sm text-[var(--danger-text,#b42318)]">{error}</p>}
    </div>
  );
}

type ChangeHandler = (e: React.ChangeEvent<HTMLInputElement>) => void;

const TD = "px-2 py-3 align-top";

/** An amount box with, once there is an amount, the note that goes with it. Module level so it isn't remounted on every keystroke. */
function AmountCell({ label, amount, note, onAmount, onNote, placeholder, required, disabled, sign }: { label: string; amount: string; note: string; onAmount: (v: string) => void; onNote: ChangeHandler; placeholder: string; required: boolean; disabled: boolean; sign: "−" | "±" }) {
  const has = Number(amount || 0) !== 0;
  if (disabled) {
    return (
      <td className={`${TD} text-right tabular-nums text-secondary`}>
        {has ? <>{Number(amount) < 0 || sign === "−" ? "−" : "+"}{Math.abs(Number(amount)).toFixed(2)}</> : "—"}
        {has && note && <span className="block max-w-32 truncate text-xs text-subtle" title={note}>{note}</span>}
      </td>
    );
  }
  return (
    <td className={TD}>
      <NumberInput step={0.01} value={amount} onChange={(v) => onAmount(String(v))} ariaLabel={`${label} (AED)`} inputClassName="h-8 w-24 text-right tabular-nums" />
      {has && <input value={note} onChange={onNote} placeholder={placeholder} aria-label={`${label} note`} aria-required={required} className={`input mt-1 h-7 w-36 text-xs ${required && !note.trim() ? "border-[var(--warning)]" : ""}`} />}
    </td>
  );
}

/**
 * The three things typed against a line, as three table cells: a deduction (a fine,
 * damage...), the advance recovered this month, and an adjustment (+ or −). Each amount
 * asks for a note once it is filled in. One Save writes all three and recomputes net pay.
 */
export function LineAdjustCells({
  lineId, deduction, deductionNote, advance, advanceNote, adjustment, adjustmentNote, bankCharge, bankWaived, disabled,
}: {
  lineId: string; deduction: number; deductionNote: string; advance: number; advanceNote: string; adjustment: number; adjustmentNote: string; bankCharge: number; bankWaived: boolean; disabled: boolean;
}) {
  const [pending, start] = useTransition();
  const [v, setV] = useState({ deduction: String(deduction || ""), deductionNote, advance: String(advance || ""), advanceNote, adjustment: String(adjustment || ""), adjustmentNote });
  // The bank charge for paying this worker, typed here; the tick waives it (the amount is kept so un-ticking brings it back).
  const [bank, setBank] = useState({ amount: String(bankCharge || ""), waived: bankWaived });
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const dirty =
    Number(v.deduction || 0) !== deduction || v.deductionNote !== deductionNote || Number(v.advance || 0) !== advance || v.advanceNote !== advanceNote ||
    Number(v.adjustment || 0) !== adjustment || v.adjustmentNote !== adjustmentNote || Number(bank.amount || 0) !== bankCharge || bank.waived !== bankWaived;
  const amount = (k: "deduction" | "advance" | "adjustment") => (val: string) => { setSaved(false); setV((p) => ({ ...p, [k]: val })); };
  const note = (k: "deductionNote" | "advanceNote" | "adjustmentNote"): ChangeHandler => (e) => { setSaved(false); setV((p) => ({ ...p, [k]: e.target.value })); };

  function save() {
    setError(null);
    start(async () => {
      const fd = new FormData();
      fd.set("lineId", lineId);
      for (const [k, val] of Object.entries(v)) fd.set(k, val);
      fd.set("bankSent", "1");
      fd.set("bankCharge", bank.amount);
      fd.set("bankWaived", bank.waived ? "1" : "0");
      const res = await saveLineAction(fd);
      if (res.error) setError(res.error); else setSaved(true);
    });
  }

  return (
    <>
      <AmountCell label="Deduction" amount={v.deduction} note={v.deductionNote} onAmount={amount("deduction")} onNote={note("deductionNote")} placeholder="What for? (fine, damage…)" required disabled={disabled} sign="−" />
      <AmountCell label="Advance" amount={v.advance} note={v.advanceNote} onAmount={amount("advance")} onNote={note("advanceNote")} placeholder="Note (advance taken on…)" required disabled={disabled} sign="−" />
      <AmountCell label="Adjustment" amount={v.adjustment} note={v.adjustmentNote} onAmount={amount("adjustment")} onNote={note("adjustmentNote")} placeholder="Bonus / correction (− to deduct)" required={false} disabled={disabled} sign="±" />
      {disabled ? (
        <td className={`${TD} text-right tabular-nums text-secondary`}>
          {bankCharge > 0 ? (bankWaived ? <span title="Waived: nothing is taken" className="text-muted line-through">{bankCharge.toFixed(2)}</span> : <>−{bankCharge.toFixed(2)}</>) : "—"}
          {bankCharge > 0 && bankWaived && <span className="block text-xs text-subtle">Waived</span>}
        </td>
      ) : (
        <td className={TD}>
          <NumberInput step={0.01} value={bank.amount} onChange={(val) => { setSaved(false); setBank((b) => ({ ...b, amount: String(val) })); }} ariaLabel="Bank charge (AED)" inputClassName={`h-8 w-24 text-right tabular-nums ${bank.waived ? "line-through opacity-60" : ""}`} />
          <label className="mt-1 flex items-center gap-1.5 text-xs text-muted"><input type="checkbox" checked={bank.waived} onChange={(e) => { setSaved(false); setBank((b) => ({ ...b, waived: e.target.checked })); }} /> Waive</label>
        </td>
      )}
      {!disabled && (
        <td className={TD}>
          {dirty && <button type="button" className="btn btn-primary h-8 px-3 text-xs" disabled={pending} onClick={save}>{pending ? "Saving…" : "Save"}</button>}
          {saved && !dirty && <span className="text-xs text-[var(--success)]">Saved</span>}
          {error && <p role="alert" className="mt-1 max-w-40 text-xs text-[var(--error)]">{error}</p>}
        </td>
      )}
    </>
  );
}
