"use client";

import Link from "next/link";
import { useActionState, useState, useTransition } from "react";
import { Check, FileText, Plus, X } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/Dialog";
import { Select } from "@/components/ui/Select";
import { Badge, type BadgeColor } from "@/components/Badge";
import { approveAdvanceAction, cancelLoanAction, createLoanAction, markAdvanceGivenAction, rejectAdvanceAction, setLoanPlanAction } from "../pay-items-actions";
import { MonthInput } from "@/components/ui/MonthInput";
import { NumberInput } from "@/components/ui/NumberInput";
import { readOtherDoc } from "@/components/otherDocRead";
import { DatePicker } from "@/components/ui/DatePicker";
import { ADVANCE_METHODS } from "@/lib/advances";
import { ReceiptButton } from "./receipt-button";

type State = { error: string | null; ok?: boolean };
export type LoanRow = {
  id: string; ref: string; employeeId: string; employee: string; employeeIdNo: string; type: string; principal: number; repaid: number; instalment: number; startMonth: string;
  reason: string | null; stateKey: string; stateLabel: string; plan: string; givenDate: string | null; approvedBy: string | null; decisionNote: string | null; requestedBy: string; requestedOn: string; mine: boolean;
  planPending: boolean; repaidAny: boolean; files: { id: string; name: string }[];
};

const STATE_COLOR: Record<string, BadgeColor> = { PENDING: "amber", TO_GIVE: "blue", RECOVERING: "blue", CLEARED: "green", REJECTED: "red", CANCELLED: "slate" };
const aed = (n: number) => n.toLocaleString("en-AE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const thisMonth = () => new Date().toISOString().slice(0, 7);
const today = () => new Date().toISOString().slice(0, 10);

type PlanMode = "ONE_MONTH" | "EQUAL" | "CUSTOM" | "LATER";
type PlanRow = { month: string; amount: string };

/** The "how is it deducted" choices, shared by a new request and by choosing the months afterwards. */
function PlanFields({ mode, setMode, rows, setRows, principal, allowLater }: { mode: PlanMode; setMode: (m: PlanMode) => void; rows: PlanRow[]; setRows: React.Dispatch<React.SetStateAction<PlanRow[]>>; principal: number; allowLater?: boolean }) {
  const total = principal;
  const planned = rows.reduce((s, r) => s + Number(r.amount || 0), 0);
  return (
    <fieldset className="space-y-2 rounded-md border border-default p-3">
        <legend className="px-1 text-xs font-medium text-muted">How is it deducted from salary?</legend>
        <label className="flex items-center gap-2 text-sm"><input type="radio" checked={mode === "ONE_MONTH"} onChange={() => setMode("ONE_MONTH")} /> All in one month</label>
        <label className="flex items-center gap-2 text-sm"><input type="radio" checked={mode === "EQUAL"} onChange={() => setMode("EQUAL")} /> The same amount every month</label>
        <label className="flex items-center gap-2 text-sm"><input type="radio" checked={mode === "CUSTOM"} onChange={() => setMode("CUSTOM")} /> Choose the amount for each month</label>
        {allowLater && <label className="flex items-center gap-2 text-sm"><input type="radio" checked={mode === "LATER"} onChange={() => setMode("LATER")} /> Decide later <span className="text-xs text-muted">(approve now, choose the month before payroll)</span></label>}
        {mode === "LATER" && <p className="text-xs text-muted">Nothing is deducted until a month is chosen. Whoever approves it is reminded to choose one, and the payroll run shows it so it isn&apos;t missed.</p>}
        {mode === "ONE_MONTH" && <label className="block"><span className="mb-1 block text-xs font-medium text-muted">Deduct in *</span><MonthInput name="month" defaultValue={thisMonth()} required className="w-full" /></label>}
        {mode === "EQUAL" && (
          <div className="grid grid-cols-2 gap-3">
            <label className="block"><span className="mb-1 block text-xs font-medium text-muted">First month *</span><MonthInput name="startMonth" defaultValue={thisMonth()} required className="w-full" /></label>
            <label className="block"><span className="mb-1 block text-xs font-medium text-muted">Per month (AED) *</span><NumberInput name="instalment" required min={0} step={0.01} className="w-full" /></label>
          </div>
        )}
        {mode === "CUSTOM" && (
          <div className="space-y-2">
            {rows.map((r, i) => (
              <div key={i} className="grid grid-cols-[1fr_8rem_auto] items-end gap-2">
                <MonthInput value={r.month} onChange={(v) => setRows((all) => all.map((x, k) => (k === i ? { ...x, month: v } : x)))} className="w-full" />
                <NumberInput value={r.amount} min={0} step={0.01} onChange={(v) => setRows((all) => all.map((x, k) => (k === i ? { ...x, amount: String(v) } : x)))} className="w-full" />
                <button type="button" aria-label="Remove month" className="p-2 text-muted hover:text-[var(--error)]" disabled={rows.length === 1} onClick={() => setRows((all) => all.filter((_, k) => k !== i))}><X className="h-4 w-4" aria-hidden /></button>
              </div>
            ))}
            <div className="flex items-center justify-between text-xs">
              <button type="button" className="font-medium text-[var(--brand-primary)] hover:underline" onClick={() => setRows((all) => [...all, { month: all.length ? addOne(all[all.length - 1].month) : thisMonth(), amount: "" }])}>+ Add a month</button>
              <span className={Math.round(planned * 100) === Math.round(total * 100) && total > 0 ? "text-[var(--success)]" : "text-[var(--warning)]"}>Plan adds up to AED {aed(planned)} of AED {aed(total)}</span>
            </div>
          </div>
        )}
      </fieldset>
  );
}

function NewAdvanceForm({ employees, onDone }: { employees: { id: string; label: string }[]; onDone: () => void }) {
  const [mode, setMode] = useState<PlanMode>("ONE_MONTH");
  const [principal, setPrincipal] = useState("");
  const [rows, setRows] = useState<{ month: string; amount: string }[]>([{ month: thisMonth(), amount: "" }]);
  const [state, action, pending] = useActionState(
    async (prev: State, fd: FormData) => {
      fd.set("planMode", mode);
      if (mode === "CUSTOM") fd.set("planRows", JSON.stringify(rows.map((r) => ({ month: r.month, amount: Number(r.amount || 0) }))));
      const res = await createLoanAction(prev, fd);
      if (res.ok) onDone();
      return res;
    },
    { error: null } as State
  );
  const total = Number(principal || 0);
  return (
    <form action={action} className="mt-4 space-y-3">
      <label className="block">
        <span className="mb-1 block text-xs font-medium text-muted">Employee *</span>
        <Select name="employeeId" defaultValue="" placeholder="Choose an employee…" options={employees.map((e) => ({ value: e.id, label: e.label }))} />
      </label>
      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-muted">Type</span>
          <Select name="type" defaultValue="ADVANCE" searchable={false} options={[{ value: "ADVANCE", label: "Salary advance" }, { value: "LOAN", label: "Loan" }]} />
        </label>
        <label className="block"><span className="mb-1 block text-xs font-medium text-muted">Amount (AED) *</span><NumberInput name="principal" required min={0} step={0.01} className="w-full" onChange={(v) => setPrincipal(String(v))} /></label>
      </div>
      <label className="block"><span className="mb-1 block text-xs font-medium text-muted">Reason *</span><input name="reason" required className="input w-full" placeholder="What is it for?" /></label>

      <PlanFields mode={mode} setMode={setMode} rows={rows} setRows={setRows} principal={total} allowLater />
      <p className="text-xs text-muted">It goes for approval first. Nothing is deducted until it is approved and you record the day the money was handed over.</p>
      <div className="flex items-center gap-3">
        <button type="submit" className="btn btn-primary" disabled={pending}>{pending ? "Sending…" : "Request approval"}</button>
        {state.error && <p role="alert" className="text-sm text-[var(--error)]">{state.error}</p>}
      </div>
    </form>
  );
}

function addOne(month: string) {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(y, m, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

function GivenForm({ row, onDone }: { row: LoanRow; onDone: () => void }) {
  // A transfer slip or voucher: its number goes in the reference box for the person to check.
  const [reference, setReference] = useState("");
  const [refNote, setRefNote] = useState(false);
  async function readProof(file: File | undefined) {
    if (!file || reference) return;
    const read = await readOtherDoc(file);
    if (read?.docNumber) { setReference((r) => r || read.docNumber.slice(0, 80)); setRefNote(true); }
  }
  const [state, action, pending] = useActionState(
    async (prev: State, fd: FormData) => {
      const res = await markAdvanceGivenAction(fd);
      if (res.ok) onDone();
      return res.error ? res : { error: null, ok: true };
    },
    { error: null } as State
  );
  void state;
  return (
    <form action={action} className="mt-4 space-y-3">
      <input type="hidden" name="id" value={row.id} />
      <label className="block"><span className="mb-1 block text-xs font-medium text-muted">Day it was handed over *</span><DatePicker name="givenDate" defaultValue={today()} /></label>
      <label className="block"><span className="mb-1 block text-xs font-medium text-muted">How was it paid?</span><Select name="method" defaultValue="CASH" searchable={false} options={ADVANCE_METHODS.map(([value, label]) => ({ value, label }))} /></label>
      <label className="block"><span className="mb-1 block text-xs font-medium text-muted">Reference (voucher or transfer number, optional)</span><input name="reference" value={reference} onChange={(e) => setReference(e.target.value)} className="input w-full" maxLength={80} />{refNote && <span className="mt-1 block text-xs text-muted">Read from the attached file. Check it before saving.</span>}</label>
      <label className="block"><span className="mb-1 block text-xs font-medium text-muted">Attach proof (signed voucher, transfer slip… optional, up to 5)</span><input type="file" name="files" multiple accept="application/pdf,image/*" className="input w-full" onChange={(e) => void readProof(e.target.files?.[0])} /></label>
      <p className="text-xs text-muted">Deduction from payroll follows the plan&apos;s months once this is recorded, even for an earlier pay month (salary paid late). The day cannot be changed afterwards.</p>
      <div className="flex items-center gap-3">
        <button type="submit" className="btn btn-primary" disabled={pending}>{pending ? "Saving…" : "Record as given"}</button>
        {state.error && <p role="alert" className="text-sm text-[var(--error)]">{state.error}</p>}
      </div>
    </form>
  );
}

function SetPlanForm({ row, onDone }: { row: LoanRow; onDone: () => void }) {
  const [mode, setMode] = useState<PlanMode>("ONE_MONTH");
  const [rows, setRows] = useState<PlanRow[]>([{ month: thisMonth(), amount: "" }]);
  const [state, action, pending] = useActionState(
    async (prev: State, fd: FormData) => {
      fd.set("planMode", mode);
      if (mode === "CUSTOM") fd.set("planRows", JSON.stringify(rows.map((r) => ({ month: r.month, amount: Number(r.amount || 0) }))));
      const res = await setLoanPlanAction(prev, fd);
      if (res.ok) onDone();
      return res;
    },
    { error: null } as State
  );
  return (
    <form action={action} className="mt-4 space-y-3">
      <input type="hidden" name="id" value={row.id} />
      <PlanFields mode={mode} setMode={setMode} rows={rows} setRows={setRows} principal={row.principal} />
      <div className="flex items-center gap-3">
        <button type="submit" className="btn btn-primary" disabled={pending}>{pending ? "Saving…" : "Save months"}</button>
        {state.error && <p role="alert" className="text-sm text-[var(--error)]">{state.error}</p>}
      </div>
    </form>
  );
}

export function LoansBoard({ rows, employees, canCreate, canEdit, canApprove }: { rows: LoanRow[]; employees: { id: string; label: string }[]; canCreate: boolean; canEdit: boolean; canApprove: boolean }) {
  const [open, setOpen] = useState(false);
  const [giving, setGiving] = useState<LoanRow | null>(null);
  const [planning, setPlanning] = useState<LoanRow | null>(null);
  const [rejecting, setRejecting] = useState<LoanRow | null>(null);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const recovering = rows.filter((r) => r.stateKey === "RECOVERING");
  const outstanding = recovering.reduce((s, r) => s + (r.principal - r.repaid), 0);
  const waiting = rows.filter((r) => r.stateKey === "PENDING").length;
  const toGive = rows.filter((r) => r.stateKey === "TO_GIVE").length;

  function run(fn: (fd: FormData) => Promise<State>, id: string, extra: Record<string, string> = {}) {
    setError(null);
    const fd = new FormData();
    fd.set("id", id);
    for (const [k, v] of Object.entries(extra)) fd.set(k, v);
    start(async () => {
      const res = await fn(fd);
      if (res.error) setError(res.error);
      else { setRejecting(null); setNote(""); }
    });
  }

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted">
          <span className="tabular font-semibold text-primary">AED {aed(outstanding)}</span> still to recover across {recovering.length} advance{recovering.length === 1 ? "" : "s"}
          {waiting > 0 && <> · <span className="font-medium text-[var(--warning)]">{waiting} awaiting approval</span></>}
          {toGive > 0 && <> · <span className="font-medium text-[var(--info)]">{toGive} approved, not yet given</span></>}.
        </p>
        {canCreate && (
          <button type="button" className="btn btn-primary gap-1.5" onClick={() => setOpen(true)}>
            <Plus className="h-4 w-4" aria-hidden /> New advance / loan
          </button>
        )}
      </div>
      {error && <p role="alert" className="text-sm text-[var(--error)]">{error}</p>}

      {rows.length === 0 ? (
        <div className="empty-state"><p className="text-sm text-muted">No advances or loans yet. Request one: it is approved, handed over on a recorded day, and then deducted from payroll month by month as planned.</p></div>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-default bg-surface-subtle text-left text-xs font-medium uppercase tracking-wide text-muted">
              <tr>
                <th className="px-4 py-3">Ref</th>
                <th className="px-4 py-3">Employee</th>
                <th className="px-4 py-3 text-right">Amount</th>
                <th className="px-4 py-3">Deducted</th>
                <th className="px-4 py-3">Given on</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {rows.map((r) => {
                const pct = r.principal > 0 ? Math.min(100, Math.round((r.repaid / r.principal) * 100)) : 0;
                return (
                  <tr key={r.id} className="align-top">
                    <td className="px-4 py-3 text-xs text-muted tabular-nums">{r.ref}</td>
                    <td className="px-4 py-3">
                      <Link href={`/payroll/loans/employee/${r.employeeId}`} className="font-medium text-primary hover:underline">{r.employee}</Link>
                      <p className="text-xs text-muted">{r.employeeIdNo} · {r.type === "ADVANCE" ? "Advance" : "Loan"}{r.reason ? ` · ${r.reason}` : ""}</p>
                      <p className="text-xs text-subtle">Requested {r.requestedOn} by {r.requestedBy}</p>
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-secondary">{aed(r.principal)}</td>
                    <td className="px-4 py-3">
                      <p className={r.planPending ? "text-xs font-medium text-[var(--warning)]" : "text-xs text-secondary"}>{r.plan}</p>
                      {r.files.length > 0 && <p className="mt-0.5 text-xs">{r.files.map((f) => <a key={f.id} href={`/api/attachments/${f.id}`} target="_blank" rel="noopener noreferrer" className="mr-2 text-[var(--brand-primary)] hover:underline">{f.name}</a>)}</p>}
                      {r.givenDate && (
                        <div className="mt-1 flex items-center gap-2">
                          <span className="h-1.5 w-20 overflow-hidden rounded-full bg-[var(--surface-sunken)]"><span className="block h-full rounded-full bg-[var(--brand-primary)]" style={{ width: `${pct}%` }} /></span>
                          <span className="tabular text-xs text-muted">{aed(r.repaid)}</span>
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-secondary">{r.givenDate ?? "—"}</td>
                    <td className="px-4 py-3">
                      <Badge color={STATE_COLOR[r.stateKey] ?? "slate"} dot>{r.stateLabel}</Badge>
                      {r.approvedBy && r.stateKey !== "PENDING" && <p className="mt-1 text-xs text-muted">{r.stateKey === "REJECTED" ? "Not approved" : "Approved"} by {r.approvedBy}</p>}
                      {r.decisionNote && r.stateKey === "REJECTED" && <p className="text-xs text-muted">{r.decisionNote}</p>}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap justify-end gap-x-3 gap-y-1 text-xs font-medium">
                        {canApprove && r.stateKey === "PENDING" && (
                          <>
                            <button type="button" disabled={pending} className="inline-flex items-center gap-1 text-[var(--success)] hover:underline" onClick={() => run(approveAdvanceAction, r.id)}><Check className="h-3 w-3" aria-hidden /> Approve</button>
                            <button type="button" disabled={pending} className="text-[var(--error)] hover:underline" onClick={() => { setError(null); setRejecting(r); }}>Reject</button>
                          </>
                        )}
                        {canEdit && (r.stateKey === "PENDING" || r.stateKey === "TO_GIVE" || r.stateKey === "RECOVERING") && !r.repaidAny && (
                          <button type="button" className={r.planPending ? "font-semibold text-[var(--warning)] hover:underline" : "text-[var(--brand-primary)] hover:underline"} onClick={() => setPlanning(r)}>{r.planPending ? "Choose month" : "Change months"}</button>
                        )}
                        {canEdit && r.stateKey === "TO_GIVE" && <button type="button" className="text-[var(--brand-primary)] hover:underline" onClick={() => setGiving(r)}>Record as given</button>}
                        {r.stateKey !== "REJECTED" && r.stateKey !== "CANCELLED" && <ReceiptButton id={r.id} label={r.givenDate ? "Receipt" : "Request letter"} icon={<FileText className="h-3 w-3" aria-hidden />} />}
                        {canEdit && (r.stateKey === "RECOVERING" || r.stateKey === "TO_GIVE" || r.stateKey === "PENDING") && (
                          <button
                            type="button"
                            className="text-[var(--error)] hover:underline"
                            onClick={() => {
                              if (!confirm(`${r.stateKey === "RECOVERING" ? "Stop recovering" : "Cancel"} ${r.employee}'s ${r.type === "ADVANCE" ? "advance" : "loan"}? What was already recovered stays recorded.`)) return;
                              run(cancelLoanAction, r.id);
                            }}
                          >
                            {r.stateKey === "RECOVERING" ? "Stop recovery" : "Cancel"}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent title="New advance or loan" description="Request it, get it approved, record the day it is handed over, and it is deducted from payroll as planned.">
          <NewAdvanceForm employees={employees} onDone={() => setOpen(false)} />
        </DialogContent>
      </Dialog>
      <Dialog open={!!planning} onOpenChange={(v) => !v && setPlanning(null)}>
        <DialogContent title="Which month(s) to deduct" description={planning ? `${planning.ref} · AED ${aed(planning.principal)} for ${planning.employee}` : undefined}>
          {planning && <SetPlanForm row={planning} onDone={() => setPlanning(null)} />}
        </DialogContent>
      </Dialog>
      <Dialog open={!!giving} onOpenChange={(v) => !v && setGiving(null)}>
        <DialogContent title="Record as given" description={giving ? `${giving.ref} · AED ${aed(giving.principal)} to ${giving.employee}` : undefined}>
          {giving && <GivenForm row={giving} onDone={() => setGiving(null)} />}
        </DialogContent>
      </Dialog>
      <Dialog open={!!rejecting} onOpenChange={(v) => !v && setRejecting(null)}>
        <DialogContent title="Reject this request?" description={rejecting ? `${rejecting.ref} · ${rejecting.employee}. The person who asked will be told why.` : undefined}>
          <div className="mt-4 space-y-3">
            <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} className="input w-full" placeholder="Why is it not approved?" aria-label="Reason" />
            <div className="flex justify-end gap-2">
              <button type="button" className="btn btn-secondary" onClick={() => setRejecting(null)}>Cancel</button>
              <button type="button" className="btn btn-primary" disabled={pending || !note.trim()} onClick={() => rejecting && run(rejectAdvanceAction, rejecting.id, { note })}>Reject</button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
