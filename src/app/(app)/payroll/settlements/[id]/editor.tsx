"use client";

import { useActionState, useState, useTransition } from "react";
import { Select } from "@/components/ui/Select";
import { DatePicker } from "@/components/ui/DatePicker";
import { NumberInput } from "@/components/ui/NumberInput";
import { EXIT_REASONS } from "@/lib/exitReasons";
import { approveSettlementAction, deleteSettlementAction, markSettlementPaidAction, updateSettlementAction } from "../actions";

type State = { error: string | null; ok?: boolean };
type Draft = { id: string; exitDate: string; reason: string; basic: number; unpaidSalaryDays: number; leavePay: number; noticePay: number; otherEarnings: number; loanBalance: number; otherDeductions: number; notes: string };

export function SettlementEditor({ s }: { s: Draft }) {
  const [exitDate, setExitDate] = useState(s.exitDate);
  const [state, action, pending] = useActionState(updateSettlementAction as (p: State, fd: FormData) => Promise<State>, { error: null } as State);
  const field = (label: string, name: keyof Draft, hint?: string) => (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-muted">{label}</span>
      <NumberInput name={name} defaultValue={s[name] as number} min={0} step={0.01} className="w-full" />
      {hint && <span className="mt-1 block text-xs text-muted">{hint}</span>}
    </label>
  );
  return (
    <form action={action} className="card space-y-4 p-4 print:hidden">
      <input type="hidden" name="id" value={s.id} />
      <div>
        <h2 className="text-sm font-semibold text-primary">Work it out</h2>
        <p className="text-xs text-muted">Gratuity and the salary for unpaid days are worked out for you. Type in leave and notice pay, and anything else owed either way, then save.</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="block"><span className="mb-1 block text-xs font-medium text-muted">Last working day</span><DatePicker name="exitDate" value={exitDate} onChange={setExitDate} className="w-full" /></label>
        <label className="block"><span className="mb-1 block text-xs font-medium text-muted">Reason</span><Select name="reason" defaultValue={s.reason} searchable={false} options={EXIT_REASONS.map((r) => ({ value: r, label: r }))} /></label>
        {field("Monthly basic for gratuity (AED)", "basic", "Gratuity is on the basic wage only.")}
        {field("Days worked not paid by a payroll run", "unpaidSalaryDays", "Zero when the last payroll run already covers the exit month.")}
        {field("Leave pay (AED)", "leavePay")}
        {field("Notice pay (AED)", "noticePay")}
        {field("Other amounts due to the employee (AED)", "otherEarnings")}
        {field("Loans and advances to recover (AED)", "loanBalance", "Filled from active loans; they are cleared when this is approved.")}
        {field("Other amounts due from the employee (AED)", "otherDeductions")}
      </div>
      <label className="block"><span className="mb-1 block text-xs font-medium text-muted">Notes (say what any deduction is for)</span><input name="notes" defaultValue={s.notes} maxLength={500} className="input w-full" /></label>
      <div className="flex items-center gap-3">
        <button type="submit" className="btn btn-primary" disabled={pending}>{pending ? "Saving…" : "Save and recalculate"}</button>
        {state.error && <p role="alert" className="text-sm text-[var(--error)]">{state.error}</p>}
        {state.ok && !state.error && <p role="status" className="text-sm text-[var(--success)]">Saved.</p>}
      </div>
    </form>
  );
}

export function SettlementButtons({ id, status, canApprove, canDelete }: { id: string; status: string; canApprove: boolean; canDelete: boolean }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const run = (fn: (fd: FormData) => Promise<State | void>) => () => {
    setError(null);
    const fd = new FormData(); fd.set("id", id);
    start(async () => { try { const r = await fn(fd); if (r && r.error) setError(r.error); } catch { setError("That didn't work. Check your connection and try again."); } });
  };
  return (
    <div className="flex flex-wrap items-center gap-2 print:hidden">
      {status === "DRAFT" && canApprove && <button type="button" className="btn btn-primary" disabled={pending} onClick={run(approveSettlementAction)}>Approve</button>}
      {status === "APPROVED" && canApprove && <button type="button" className="btn btn-primary" disabled={pending} onClick={run(markSettlementPaidAction)}>Mark as paid</button>}
      {status === "DRAFT" && canDelete && <button type="button" className="btn btn-secondary" disabled={pending} onClick={run(deleteSettlementAction as (fd: FormData) => Promise<void>)}>Delete draft</button>}
      {error && <p role="alert" className="text-sm text-[var(--error)]">{error}</p>}
    </div>
  );
}
