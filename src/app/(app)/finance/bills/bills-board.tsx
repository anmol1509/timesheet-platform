"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { CreditCard, Eye, Layers, Plus, Trash2 } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/Dialog";
import { Select } from "@/components/ui/Select";
import { Checkbox } from "@/components/ui/Checkbox";
import { Badge, type BadgeColor } from "@/components/Badge";
import { AttachmentUploader, type AttachmentRow } from "@/components/AttachmentUploader";
import { BILL_STATUS_LABELS, type BillStatus } from "@/lib/payables";
import { keepInput } from "@/lib/vendor/keepInput";
import { PAYMENT_METHODS } from "@/lib/financeConstants";
import Link from "next/link";
import { applyCreditAction, createBillAction, deleteBillAction, payBatchAction, previewSupplierMonthAction, recordPaymentAction } from "../actions";
import type { SupplierMonthPayable } from "@/lib/supplierMonthPayable";

type State = { error: string | null; ok?: boolean };
export type BillRow = {
  id: string; supplier: string; supplierId: string; billNo: string; billDate: string; dueDate: string;
  total: number; paid: number; balance: number; status: BillStatus; description: string | null; paymentCount: number;
  approval: string; approvalNote: string | null; viaPortal: boolean; branchId: string; periodMonth: string | null;
  variance: { diff: number; pct: number | null; state: "MATCH" | "OVER" | "UNDER" | "NO_REFERENCE"; reference: number; hours: number; billAmount: number } | null;
  payments: { id: string; paidOn: string; amount: number; method: string | null; reference: string | null }[];
  files: AttachmentRow[];
};
const COLOR: Record<BillStatus, BadgeColor> = { PAID: "green", PARTIAL: "blue", OVERDUE: "red", UNPAID: "amber" };
const APPROVAL: Record<string, { label: string; color: BadgeColor }> = { PENDING: { label: "Awaiting approval", color: "amber" }, APPROVED: { label: "Approved", color: "green" }, REJECTED: { label: "Rejected", color: "red" } };
const aed = (n: number) => n.toLocaleString("en-AE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const errCls = "text-sm text-[var(--danger-text,#b42318)]";

function BillForm({ suppliers, onDone }: { suppliers: { id: string; name: string }[]; onDone: () => void }) {
  const [allowDuplicate, setAllowDuplicate] = useState(false);
  const [supplierId, setSupplierId] = useState("");
  const prev = new Date(); prev.setUTCMonth(prev.getUTCMonth() - 1);
  const [month, setMonth] = useState(prev.toISOString().slice(0, 7));
  const [sheet, setSheet] = useState<SupplierMonthPayable | null>(null);
  const [sheetError, setSheetError] = useState<string | null>(null);
  const amountRef = useRef<HTMLInputElement>(null);
  const [state, action, pending] = useActionState(
    async (prev: State, fd: FormData) => {
      const r = await createBillAction(prev, fd);
      if (r.ok) onDone();
      else if (r.error?.startsWith("DUPLICATE:")) setAllowDuplicate(true);
      return r;
    },
    { error: null } as State
  );

  // Show what the supplier's timesheet says for the chosen month, so the bill can be built from it and checked against it.
  useEffect(() => {
    let alive = true;
    if (!supplierId || !month) return;
    previewSupplierMonthAction(supplierId, month).then((r) => { if (!alive) return; setSheetError(r.error); setSheet(r.sheet ?? null); });
    return () => { alive = false; };
  }, [supplierId, month]);

  const today = new Date().toISOString().slice(0, 10);
  const dup = state.error?.startsWith("DUPLICATE:");
  const useSheet = () => { if (amountRef.current && sheet) { amountRef.current.value = String(sheet.net); amountRef.current.dispatchEvent(new Event("input", { bubbles: true })); } };
  return (
    <form onSubmit={keepInput(action)} className="mt-4 space-y-3">
      {allowDuplicate && <input type="hidden" name="allowDuplicate" value="1" />}
      <label className="block"><span className="mb-1 block text-xs font-medium text-muted">Supplier</span><Select name="supplierId" placeholder="Choose a supplier…" value={supplierId} onChange={(v) => { setSupplierId(v); setSheet(null); }} options={suppliers.map((s) => ({ value: s.id, label: s.name }))} /></label>
      <div className="grid grid-cols-2 gap-3">
        <label className="block"><span className="mb-1 block text-xs font-medium text-muted">Month the bill covers *</span><input type="month" name="periodMonth" required value={month} onChange={(e) => { setMonth(e.target.value); setSheet(null); }} className="input w-full" /></label>
        <label className="block"><span className="mb-1 block text-xs font-medium text-muted">Bill number</span><input name="billNo" required className="input w-full" /></label>
      </div>
      {supplierId && month && (
        <div className="rounded-control border border-default bg-surface-subtle p-3 text-sm">
          <p className="text-xs font-semibold tracking-wide text-muted uppercase">Timesheet for {month}</p>
          {sheetError ? <p className="mt-1 text-xs text-[var(--error)]">{sheetError}</p> : !sheet ? <p className="mt-1 text-xs text-muted">Loading…</p> : sheet.entryCount === 0 ? (
            <p className="mt-1 text-xs text-muted">This supplier has no timesheet for {month}, so there is nothing to check the bill against.</p>
          ) : (
            <>
              <ul className="mt-1.5 space-y-0.5 text-xs text-secondary">
                {sheet.byTrade.map((l) => <li key={`${l.trade}-${l.rate}`} className="flex justify-between gap-3"><span>{l.trade} · {l.hours} h × AED {aed(l.rate)}</span><span className="tabular">{aed(l.amount)}</span></li>)}
                {sheet.absentDeduction > 0 && <li className="flex justify-between gap-3 text-muted"><span>Absence deductions</span><span className="tabular">−{aed(sheet.absentDeduction)}</span></li>}
                {sheet.gasDeduction > 0 && <li className="flex justify-between gap-3 text-muted"><span>Gas deduction</span><span className="tabular">−{aed(sheet.gasDeduction)}</span></li>}
              </ul>
              <div className="mt-2 flex flex-wrap items-center justify-between gap-2 border-t border-default pt-2"><span className="font-medium text-primary">Timesheet total: AED <span className="tabular">{aed(sheet.net)}</span></span><button type="button" className="text-xs font-medium text-[var(--brand-primary)] hover:underline" onClick={useSheet}>Use this amount</button></div>
              {sheet.notFinal > 0 && <p className="mt-1.5 text-xs text-[var(--warning)]">{sheet.notFinal} timesheet row{sheet.notFinal === 1 ? " is" : "s are"} not approved yet, so this may still change.</p>}
            </>
          )}
        </div>
      )}
      <div className="grid grid-cols-2 gap-3">
        <label className="block"><span className="mb-1 block text-xs font-medium text-muted">Bill date</span><input type="date" name="billDate" required defaultValue={today} className="input w-full" /></label>
        <label className="block"><span className="mb-1 block text-xs font-medium text-muted">Due date</span><input type="date" name="dueDate" required className="input w-full" /></label>
        <label className="block"><span className="mb-1 block text-xs font-medium text-muted">Amount (AED, before VAT)</span><input ref={amountRef} type="number" step="0.01" min="0" name="amount" required className="input w-full" /></label>
        <label className="block"><span className="mb-1 block text-xs font-medium text-muted">VAT (AED)</span><input type="number" step="0.01" min="0" name="vatAmount" defaultValue="0" className="input w-full" /></label>
      </div>
      <label className="block"><span className="mb-1 block text-xs font-medium text-muted">Description</span><input name="description" className="input w-full" placeholder="e.g. Labour supply, Aug" /></label>
      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" className="btn btn-primary" disabled={pending}>{pending ? "Saving…" : dup ? "Keep both — add anyway" : "Add bill"}</button>
        {state.error && <p role="alert" className={dup ? "text-sm text-[var(--warning)]" : errCls}>{state.error.replace("DUPLICATE: ", "")}</p>}
      </div>
      <p className="text-xs text-subtle">The bill is checked against the timesheet when it is saved, and the difference is shown before anyone approves it. New bills wait for approval before they can be paid.</p>
    </form>
  );
}

function PayForm({ bill, onDone }: { bill: BillRow; onDone: () => void }) {
  const [state, action, pending] = useActionState(
    async (prev: State, fd: FormData) => { const r = await recordPaymentAction(prev, fd); if (r.ok) onDone(); return r; },
    { error: null } as State
  );
  return (
    <form action={action} className="mt-4 space-y-3">
      <input type="hidden" name="billId" value={bill.id} />
      <div className="grid grid-cols-2 gap-3">
        <label className="block"><span className="mb-1 block text-xs font-medium text-muted">Paid on</span><input type="date" name="paidOn" required defaultValue={new Date().toISOString().slice(0, 10)} className="input w-full" /></label>
        <label className="block"><span className="mb-1 block text-xs font-medium text-muted">Amount (AED)</span><input type="number" step="0.01" min="0" name="amount" required defaultValue={bill.balance} className="input w-full" /></label>
        <label className="block"><span className="mb-1 block text-xs font-medium text-muted">Method</span><Select name="method" defaultValue="BANK" searchable={false} options={PAYMENT_METHODS.map((m) => ({ value: m, label: m.charAt(0) + m.slice(1).toLowerCase() }))} /></label>
        <label className="block"><span className="mb-1 block text-xs font-medium text-muted">Reference</span><input name="reference" className="input w-full" placeholder="Transfer / cheque no." /></label>
      </div>
      <div className="flex items-center gap-3"><button type="submit" className="btn btn-primary" disabled={pending}>{pending ? "Saving…" : "Record payment"}</button>{state.error && <p role="alert" className={errCls}>{state.error}</p>}</div>
    </form>
  );
}

function BatchForm({ bills, onDone }: { bills: BillRow[]; onDone: () => void }) {
  const [state, action, pending] = useActionState(
    async (prev: State, fd: FormData) => { const r = await payBatchAction(prev, fd); if (r.ok) onDone(); return r; },
    { error: null } as State
  );
  const total = bills.reduce((s, b) => s + b.balance, 0);
  return (
    <form action={action} className="mt-4 space-y-3">
      {bills.map((b) => <input key={b.id} type="hidden" name="billId" value={b.id} />)}
      <ul className="max-h-40 space-y-1 overflow-y-auto rounded-control border border-default p-2 text-sm">
        {bills.map((b) => <li key={b.id} className="flex justify-between gap-3"><span className="truncate text-secondary">{b.supplier} · #{b.billNo}</span><span className="tabular text-primary">{aed(b.balance)}</span></li>)}
      </ul>
      <p className="text-sm text-muted">Each bill is paid in full: <span className="tabular font-semibold text-primary">AED {aed(total)}</span></p>
      <div className="grid grid-cols-3 gap-3">
        <label className="block"><span className="mb-1 block text-xs font-medium text-muted">Paid on</span><input type="date" name="paidOn" required defaultValue={new Date().toISOString().slice(0, 10)} className="input w-full" /></label>
        <label className="block"><span className="mb-1 block text-xs font-medium text-muted">Method</span><Select name="method" defaultValue="BANK" searchable={false} options={PAYMENT_METHODS.map((m) => ({ value: m, label: m.charAt(0) + m.slice(1).toLowerCase() }))} /></label>
        <label className="block"><span className="mb-1 block text-xs font-medium text-muted">Batch reference</span><input name="reference" className="input w-full" placeholder="Transfer batch no." /></label>
      </div>
      <div className="flex items-center gap-3"><button type="submit" className="btn btn-primary" disabled={pending}>{pending ? "Recording…" : `Record ${bills.length} payments`}</button>{state.error && <p role="alert" className={errCls}>{state.error}</p>}</div>
    </form>
  );
}

function CreditForm({ bill }: { bill: BillRow }) {
  const [state, action, pending] = useActionState(async (p: State, fd: FormData) => applyCreditAction(p, fd), { error: null } as State);
  return (
    <form action={action} className="mt-2 flex flex-wrap items-end gap-2">
      <input type="hidden" name="billId" value={bill.id} />
      <label className="block"><span className="mb-1 block text-xs font-medium text-muted">Credit (AED)</span><input type="number" step="0.01" min="0" name="amount" required className="input w-28" /></label>
      <label className="block"><span className="mb-1 block text-xs font-medium text-muted">Reason / credit note no.</span><input name="reason" required className="input w-56" /></label>
      <button type="submit" className="btn btn-secondary" disabled={pending}>Apply credit</button>
      {state.error && <p role="alert" className={errCls}>{state.error}</p>}
      {state.ok && <span className="text-sm text-[var(--success)]">Applied</span>}
    </form>
  );
}

const VARIANCE_TEXT = { MATCH: "The bill matches the timesheet", OVER: "The bill is more than the timesheet says we owe", UNDER: "The bill is less than the timesheet says we owe", NO_REFERENCE: "There is no timesheet to compare with" } as const;

export function BillsBoard({ rows, suppliers, canCreate, canPay, canDelete }: { rows: BillRow[]; suppliers: { id: string; name: string }[]; canCreate: boolean; canPay: boolean; canDelete: boolean }) {
  const [adding, setAdding] = useState(false);
  const [paying, setPaying] = useState<BillRow | null>(null);
  const [viewing, setViewing] = useState<string | null>(null);
  const [batching, setBatching] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const viewingRow = viewing ? rows.find((r) => r.id === viewing) ?? null : null;
  const payable = (b: BillRow) => b.balance > 0 && b.approval === "APPROVED";
  const selectedRows = rows.filter((r) => selected.has(r.id) && payable(r));
  const toggle = (id: string) => setSelected((prev) => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  const run = (fn: (fd: FormData) => Promise<State>, fields: Record<string, string>, after?: () => void) =>
    start(async () => {
      setError(null);
      const fd = new FormData();
      for (const [k, v] of Object.entries(fields)) fd.set(k, v);
      const r = await fn(fd);
      if (r.error) setError(r.error); else after?.();
    });

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-sm text-muted">
          {selectedRows.length > 0 && <span><span className="font-medium text-primary">{selectedRows.length}</span> selected · AED <span className="tabular font-medium text-primary">{aed(selectedRows.reduce((s, b) => s + b.balance, 0))}</span></span>}
        </div>
        <div className="flex gap-2">
          {canPay && selectedRows.length > 0 && <button type="button" className="btn btn-secondary" onClick={() => setBatching(true)}><Layers className="h-4 w-4" aria-hidden /> Pay selected</button>}
          {canCreate && <button type="button" className="btn btn-primary" onClick={() => setAdding(true)}><Plus className="h-4 w-4" aria-hidden /> Add bill</button>}
        </div>
      </div>
      {error && <p role="alert" className={errCls}>{error}</p>}
      {rows.length === 0 ? <div className="card p-10 text-center text-sm text-muted">No bills here.</div> : (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-default bg-surface-subtle text-left text-xs font-medium uppercase tracking-wide text-muted">
              <tr>{canPay && <th className="w-10 px-4 py-3" />}<th className="px-4 py-3">Supplier / bill</th><th className="px-3 py-3">Due</th><th className="px-3 py-3 text-right">Total</th><th className="px-3 py-3 text-right">Balance</th><th className="px-3 py-3">Status</th><th className="px-3 py-3" /></tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {rows.map((b) => (
                <tr key={b.id} className="align-top">
                  {canPay && <td className="px-4 py-3">{payable(b) && <Checkbox checked={selected.has(b.id)} onCheckedChange={() => toggle(b.id)} ariaLabel={`Select bill ${b.billNo}`} />}</td>}
                  <td className="px-4 py-3">
                    <p className="font-medium text-primary">{b.supplier}</p>
                    <p className="text-xs text-muted">#{b.billNo} · {b.billDate}{b.description ? ` · ${b.description}` : ""}{b.viaPortal ? " · submitted by supplier" : ""}</p>
                    {b.variance && b.variance.state !== "MATCH" && b.variance.state !== "NO_REFERENCE" && <p className="mt-0.5 text-xs font-medium text-[var(--warning)]">{b.variance.diff > 0 ? "+" : "−"}AED {aed(Math.abs(b.variance.diff))} ({Math.abs(b.variance.pct ?? 0)}%) {b.variance.state === "OVER" ? "above" : "below"} the {b.periodMonth} timesheet</p>}
                    {b.variance?.state === "MATCH" && <p className="mt-0.5 text-xs text-[var(--success)]">Matches the {b.periodMonth} timesheet</p>}
                    {!b.variance && b.periodMonth && <p className="mt-0.5 text-xs text-subtle">No timesheet for {b.periodMonth}</p>}
                  </td>
                  <td className="px-3 py-3 whitespace-nowrap text-secondary">{b.dueDate}</td>
                  <td className="px-3 py-3 text-right tabular-nums text-secondary">{aed(b.total)}</td>
                  <td className="px-3 py-3 text-right font-medium tabular-nums text-primary">{aed(b.balance)}</td>
                  <td className="px-3 py-3">
                    <div className="flex flex-col items-start gap-1">
                      {b.approval === "APPROVED" ? <Badge color={COLOR[b.status]} dot>{BILL_STATUS_LABELS[b.status]}</Badge> : <Badge color={APPROVAL[b.approval]?.color ?? "slate"} dot>{APPROVAL[b.approval]?.label ?? b.approval}</Badge>}
                      {b.approval === "REJECTED" && b.approvalNote && <span className="max-w-40 truncate text-xs text-muted" title={b.approvalNote}>{b.approvalNote}</span>}
                    </div>
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex justify-end gap-1.5">
                      {b.approval === "PENDING" && <Link href="/approvals?type=BILL" className="btn btn-secondary">Review in Approvals</Link>}
                      {payable(b) && canPay && <button type="button" className="btn btn-secondary" onClick={() => setPaying(b)}><CreditCard className="h-4 w-4" aria-hidden /> Pay</button>}
                      <button type="button" className="btn btn-secondary" onClick={() => setViewing(b.id)} aria-label="Details"><Eye className="h-4 w-4" aria-hidden />{b.files.length > 0 ? b.files.length : ""}</button>
                      {b.paymentCount === 0 && canDelete && (
                        <button type="button" className="rounded-md p-1.5 text-subtle hover:bg-surface-hover hover:text-secondary" aria-label="Delete bill" disabled={pending}
                          onClick={() => run(deleteBillAction, { id: b.id })}><Trash2 className="h-4 w-4" /></button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={adding} onOpenChange={setAdding}><DialogContent title="Add supplier bill"><BillForm suppliers={suppliers} onDone={() => setAdding(false)} /></DialogContent></Dialog>
      <Dialog open={paying !== null} onOpenChange={(o) => !o && setPaying(null)}>
        {paying && <DialogContent title={`Pay ${paying.supplier}`} description={`Bill #${paying.billNo} — balance AED ${aed(paying.balance)}`}><PayForm bill={paying} onDone={() => setPaying(null)} /></DialogContent>}
      </Dialog>
      <Dialog open={batching} onOpenChange={setBatching}>
        <DialogContent title="Pay selected bills" description="One date, method and reference for the whole batch."><BatchForm bills={selectedRows} onDone={() => { setBatching(false); setSelected(new Set()); }} /></DialogContent>
      </Dialog>
      <Dialog open={viewingRow !== null} onOpenChange={(o) => !o && setViewing(null)}>
        {viewingRow && (
          <DialogContent className="max-w-xl!" title={`${viewingRow.supplier} · #${viewingRow.billNo}`} description={`Total AED ${aed(viewingRow.total)} · paid AED ${aed(viewingRow.paid)} · balance AED ${aed(viewingRow.balance)}`}>
            <div className="mt-4 space-y-5">
              {viewingRow.variance ? (
                <div className={`rounded-control border p-3 text-sm ${viewingRow.variance.state === "MATCH" ? "border-default bg-surface-subtle" : "border-[var(--warning-border)] bg-[var(--warning-soft)]"}`}>
                  <p className="font-medium text-primary">{VARIANCE_TEXT[viewingRow.variance.state]}</p>
                  <dl className="mt-1.5 grid grid-cols-3 gap-3 text-xs">
                    <div><dt className="text-muted">Timesheet {viewingRow.periodMonth}</dt><dd className="tabular font-medium text-primary">AED {aed(viewingRow.variance.reference)}</dd><dd className="text-subtle">{viewingRow.variance.hours} h</dd></div>
                    <div><dt className="text-muted">Bill (before VAT)</dt><dd className="tabular font-medium text-primary">AED {aed(viewingRow.variance.billAmount)}</dd></div>
                    <div><dt className="text-muted">Difference</dt><dd className={`tabular font-medium ${viewingRow.variance.state === "MATCH" ? "text-[var(--success)]" : "text-[var(--warning)]"}`}>{viewingRow.variance.diff >= 0 ? "+" : "−"}AED {aed(Math.abs(viewingRow.variance.diff))}</dd></div>
                  </dl>
                  <a href={`/companies/${viewingRow.supplierId}/generate?month=${viewingRow.periodMonth}`} className="mt-2 inline-block text-xs font-medium text-[var(--brand-primary)] hover:underline">Open this supplier&apos;s timesheet →</a>
                </div>
              ) : (
                <p className="text-xs text-muted">{viewingRow.periodMonth ? `This supplier had no timesheet for ${viewingRow.periodMonth} when the bill was entered, so there is nothing to compare against.` : "This bill isn't tied to a month, so it can't be checked against a timesheet."}</p>
              )}
              <div>
                <h3 className="mb-1.5 text-xs font-semibold tracking-wide text-muted uppercase">Payments</h3>
                {viewingRow.payments.length === 0 ? <p className="text-sm text-muted">Nothing paid yet.</p> : (
                  <ul className="divide-y divide-[var(--border)] text-sm">
                    {viewingRow.payments.map((p) => (
                      <li key={p.id} className="flex justify-between gap-3 py-1.5">
                        <span className="text-secondary">{p.paidOn} · {p.method === "CREDIT" ? "Credit" : p.method?.toLowerCase() ?? "payment"}{p.reference ? ` · ${p.reference}` : ""}</span>
                        <span className="tabular text-primary">{aed(p.amount)}</span>
                      </li>
                    ))}
                  </ul>
                )}
                {canPay && viewingRow.balance > 0 && viewingRow.approval === "APPROVED" && <CreditForm bill={viewingRow} />}
              </div>
              <div>
                <h3 className="mb-1.5 text-xs font-semibold tracking-wide text-muted uppercase">Bill scan &amp; documents</h3>
                <AttachmentUploader
                  entityType="SUPPLIER_BILL"
                  entityId={viewingRow.id}
                  entityBranchId={viewingRow.branchId}
                  revalidate="/finance/bills"
                  docTypeOptions={[{ value: "BILL", label: "Supplier bill" }, { value: "CREDIT_NOTE", label: "Credit note" }, { value: "PROOF", label: "Proof of payment" }, { value: "OTHER", label: "Other" }]}
                  attachments={viewingRow.files}
                />
              </div>
            </div>
          </DialogContent>
        )}
      </Dialog>
    </div>
  );
}
