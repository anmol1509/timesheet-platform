"use client";

import { keepInput } from "@/lib/vendor/keepInput";
import { useActionState, useState } from "react";
import { Paperclip, Plus } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/Dialog";
import { Badge, type BadgeColor } from "@/components/Badge";
import { BILL_STATUS_LABELS, type BillStatus } from "@/lib/payables";
import { resubmitInvoiceAction, submitInvoiceAction } from "./actions";
import { DatePicker } from "@/components/ui/DatePicker";
import { MonthInput } from "@/components/ui/MonthInput";
import { NumberInput } from "@/components/ui/NumberInput";

type State = { error: string | null; ok?: boolean };
export type InvoiceRow = {
  id: string; billNo: string; billDate: string; dueDate: string; periodMonth: string | null; description: string | null;
  amount: number; vatAmount: number; total: number; paid: number; balance: number;
  approval: string; approvalNote: string | null; paymentStatus: BillStatus; canResubmit: boolean;
  payments: { paidOn: string; amount: number; method: string | null; reference: string | null }[];
  files: { id: string; filename: string }[];
};
const PAY_COLOR: Record<BillStatus, BadgeColor> = { PAID: "green", PARTIAL: "blue", OVERDUE: "red", UNPAID: "amber" };
const aed = (n: number) => n.toLocaleString("en-AE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const thisMonth = () => new Date().toISOString().slice(0, 7);

function InvoiceForm({ row, onDone }: { row?: InvoiceRow; onDone: () => void }) {
  const [allowDuplicate, setAllowDuplicate] = useState(false);
  const [state, action, pending] = useActionState(
    async (prev: State, fd: FormData) => {
      const r = row ? await resubmitInvoiceAction(prev, fd) : await submitInvoiceAction(prev, fd);
      if (r.ok) onDone();
      else if (r.error?.startsWith("DUPLICATE:")) setAllowDuplicate(true);
      return r;
    },
    { error: null } as State
  );
  const dup = state.error?.startsWith("DUPLICATE:");
  return (
    <form onSubmit={keepInput(action)} className="mt-4 space-y-3">
      {row && <input type="hidden" name="billId" value={row.id} />}
      {allowDuplicate && <input type="hidden" name="allowDuplicate" value="1" />}
      <div className="grid grid-cols-2 gap-3">
        <label className="block"><span className="mb-1 block text-xs font-medium text-muted">Invoice number *</span><input name="billNo" required defaultValue={row?.billNo} className="input w-full" /></label>
        <label className="block"><span className="mb-1 block text-xs font-medium text-muted">Invoice date *</span><DatePicker name="billDate" defaultValue={row?.billDate ?? new Date().toISOString().slice(0, 10)} required className="w-full" /></label>
        <label className="block"><span className="mb-1 block text-xs font-medium text-muted">Month it covers *</span><MonthInput name="periodMonth" defaultValue={row?.periodMonth ?? thisMonth()} required className="w-full" /></label>
        <label className="block"><span className="mb-1 block text-xs font-medium text-muted">Amount (AED, before VAT) *</span><NumberInput name="amount" defaultValue={row?.amount} required min={0} step={0.01} className="w-full" /></label>
        <label className="block"><span className="mb-1 block text-xs font-medium text-muted">VAT (AED)</span><NumberInput name="vatAmount" defaultValue={row?.vatAmount ?? 0} min={0} step={0.01} className="w-full" /></label>
        <label className="block"><span className="mb-1 block text-xs font-medium text-muted">Description</span><input name="description" defaultValue={row?.description ?? ""} className="input w-full" placeholder="e.g. Labour supply, September" /></label>
      </div>
      <label className="block">
        <span className="mb-1 block text-xs font-medium text-muted">{row ? "Attach a corrected copy (optional)" : "Attach your invoice (PDF, JPG or PNG, up to 8MB)"}</span>
        <input type="file" name="file" accept="application/pdf,image/jpeg,image/png" required={!row} className="file-input w-full" />
      </label>
      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" className="btn btn-primary" disabled={pending}>{pending ? "Sending…" : dup ? "Submit anyway" : row ? "Resubmit invoice" : "Submit invoice"}</button>
        {state.error && <p role="alert" className={dup ? "text-sm text-[var(--warning)]" : "text-sm text-[var(--error)]"}>{state.error.replace("DUPLICATE: ", "")}</p>}
      </div>
      <p className="text-xs text-subtle">Our team reviews every invoice before it is approved for payment. You&apos;ll see the decision here.</p>
    </form>
  );
}

function Status({ r }: { r: InvoiceRow }) {
  if (r.approval === "PENDING") return <Badge color="amber" dot>Awaiting approval</Badge>;
  if (r.approval === "REJECTED") return <Badge color="red" dot>Rejected</Badge>;
  return <Badge color={PAY_COLOR[r.paymentStatus]} dot>{BILL_STATUS_LABELS[r.paymentStatus]}</Badge>;
}

export function InvoicesBoard({ rows, summary, canSubmit, aedFormat }: { rows: InvoiceRow[]; summary: { awaiting: number; rejected: number; owed: number; paid: number }; canSubmit: boolean; aedFormat: string }) {
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<InvoiceRow | null>(null);
  const [open, setOpen] = useState<string | null>(null);

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-primary">Invoices</h1>
          <p className="mt-1 text-sm text-muted">Submit your invoices, follow their approval, and see what has been paid.</p>
        </div>
        {canSubmit ? (
          <button type="button" className="btn btn-primary gap-1.5" onClick={() => setAdding(true)}><Plus className="h-4 w-4" aria-hidden /> Submit invoice</button>
        ) : (
          <p className="max-w-xs text-xs text-muted">Invoicing isn&apos;t enabled for your company yet. Please contact us.</p>
        )}
      </div>

      <div className="card grid grid-cols-2 divide-x divide-y divide-[var(--border)] overflow-hidden lg:grid-cols-4 lg:divide-y-0">
        {[
          { l: "Awaiting approval", v: String(summary.awaiting), t: summary.awaiting > 0 ? "text-[var(--warning)]" : "text-primary" },
          { l: "Rejected", v: String(summary.rejected), t: summary.rejected > 0 ? "text-[var(--error)]" : "text-primary" },
          { l: "Approved, still owed", v: `AED ${aedFormat}`, t: "text-primary" },
          { l: "Paid to you", v: `AED ${aed(summary.paid)}`, t: "text-primary" },
        ].map((c) => (
          <div key={c.l} className="p-4"><p className="text-[13px] font-medium text-muted">{c.l}</p><p className={`tabular mt-1 text-xl font-semibold tracking-tight ${c.t}`}>{c.v}</p></div>
        ))}
      </div>

      {rows.length === 0 ? (
        <div className="card p-8 text-center text-sm text-muted">No invoices yet. Submit your first one and it will appear here.</div>
      ) : (
        <ul className="card divide-y divide-[var(--border)]">
          {rows.map((r) => (
            <li key={r.id} className="px-4 py-3 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <button type="button" className="text-left" onClick={() => setOpen(open === r.id ? null : r.id)} aria-expanded={open === r.id}>
                  <span className="font-medium text-primary">Invoice {r.billNo}</span>
                  <span className="ml-2 text-xs text-muted">{r.billDate}{r.periodMonth ? ` · ${r.periodMonth}` : ""}</span>
                </button>
                <Status r={r} />
              </div>
              <p className="mt-1 tabular-nums text-secondary">Total AED {aed(r.total)}{r.approval === "APPROVED" && <> · paid AED {aed(r.paid)} · <span className="font-medium text-primary">balance AED {aed(r.balance)}</span></>}</p>
              {r.approval === "REJECTED" && (
                <div className="mt-2 rounded-control border border-[var(--error-border)] bg-[var(--error-soft)] p-3">
                  <p className="text-xs font-medium text-[var(--error)]">Rejected{r.approvalNote ? `: ${r.approvalNote}` : ""}</p>
                  {r.canResubmit && canSubmit && <button type="button" className="mt-2 text-xs font-medium text-[var(--brand-primary)] hover:underline" onClick={() => setEditing(r)}>Correct and resubmit</button>}
                </div>
              )}
              {open === r.id && (
                <div className="mt-3 space-y-2 border-t border-default pt-3 text-xs text-muted">
                  <p>Due {r.dueDate}{r.description ? ` · ${r.description}` : ""}</p>
                  {r.files.map((f) => <p key={f.id}><a href={`/vendor/files/${f.id}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[var(--brand-primary)] hover:underline"><Paperclip className="h-3 w-3" aria-hidden />{f.filename}</a></p>)}
                  {r.payments.length === 0 ? <p>{r.approval === "APPROVED" ? "No payment recorded yet." : ""}</p> : r.payments.map((p, i) => <p key={i}>Paid AED {aed(p.amount)} on {p.paidOn}{p.method ? ` by ${p.method.toLowerCase()}` : ""}{p.reference ? ` (${p.reference})` : ""}</p>)}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      <Dialog open={adding} onOpenChange={setAdding}><DialogContent title="Submit an invoice"><InvoiceForm onDone={() => setAdding(false)} /></DialogContent></Dialog>
      <Dialog open={editing !== null} onOpenChange={(o) => !o && setEditing(null)}>
        {editing && <DialogContent title={`Resubmit invoice ${editing.billNo}`} description={editing.approvalNote ? `Reason it was rejected: ${editing.approvalNote}` : undefined}><InvoiceForm row={editing} onDone={() => setEditing(null)} /></DialogContent>}
      </Dialog>
    </>
  );
}
