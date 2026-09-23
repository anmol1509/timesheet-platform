"use client";

import { useActionState, useState, useTransition } from "react";
import { CreditCard, Plus, Trash2 } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/Dialog";
import { Select } from "@/components/ui/Select";
import { Badge, type BadgeColor } from "@/components/Badge";
import { BILL_STATUS_LABELS, type BillStatus } from "@/lib/payables";
import { PAYMENT_METHODS } from "@/lib/financeConstants";
import { createBillAction, deleteBillAction, recordPaymentAction } from "../actions";

type State = { error: string | null; ok?: boolean };
export type BillRow = { id: string; supplier: string; billNo: string; billDate: string; dueDate: string; total: number; paid: number; balance: number; status: BillStatus; description: string | null; paymentCount: number };
const COLOR: Record<BillStatus, BadgeColor> = { PAID: "green", PARTIAL: "blue", OVERDUE: "red", UNPAID: "amber" };
const aed = (n: number) => n.toLocaleString("en-AE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function BillForm({ suppliers, onDone }: { suppliers: { id: string; name: string }[]; onDone: () => void }) {
  const [state, action, pending] = useActionState(
    async (prev: State, fd: FormData) => { const r = await createBillAction(prev, fd); if (r.ok) onDone(); return r; },
    { error: null } as State
  );
  const today = new Date().toISOString().slice(0, 10);
  return (
    <form action={action} className="mt-4 space-y-3">
      <label className="block"><span className="mb-1 block text-xs font-medium text-muted">Supplier</span><Select name="supplierId" placeholder="Choose a supplier…" options={suppliers.map((s) => ({ value: s.id, label: s.name }))} /></label>
      <div className="grid grid-cols-2 gap-3">
        <label className="block"><span className="mb-1 block text-xs font-medium text-muted">Bill number</span><input name="billNo" required className="input w-full" /></label>
        <label className="block"><span className="mb-1 block text-xs font-medium text-muted">Description</span><input name="description" className="input w-full" placeholder="e.g. Labour supply, Aug" /></label>
        <label className="block"><span className="mb-1 block text-xs font-medium text-muted">Bill date</span><input type="date" name="billDate" required defaultValue={today} className="input w-full" /></label>
        <label className="block"><span className="mb-1 block text-xs font-medium text-muted">Due date</span><input type="date" name="dueDate" required className="input w-full" /></label>
        <label className="block"><span className="mb-1 block text-xs font-medium text-muted">Amount (AED, before VAT)</span><input type="number" step="0.01" min="0" name="amount" required className="input w-full" /></label>
        <label className="block"><span className="mb-1 block text-xs font-medium text-muted">VAT (AED)</span><input type="number" step="0.01" min="0" name="vatAmount" defaultValue="0" className="input w-full" /></label>
      </div>
      <div className="flex items-center gap-3"><button type="submit" className="btn btn-primary" disabled={pending}>{pending ? "Saving…" : "Add bill"}</button>{state.error && <p role="alert" className="text-sm text-[var(--danger-text,#b42318)]">{state.error}</p>}</div>
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
      <div className="flex items-center gap-3"><button type="submit" className="btn btn-primary" disabled={pending}>{pending ? "Saving…" : "Record payment"}</button>{state.error && <p role="alert" className="text-sm text-[var(--danger-text,#b42318)]">{state.error}</p>}</div>
    </form>
  );
}

export function BillsBoard({ rows, suppliers, canCreate, canPay, canDelete }: { rows: BillRow[]; suppliers: { id: string; name: string }[]; canCreate: boolean; canPay: boolean; canDelete: boolean }) {
  const [adding, setAdding] = useState(false);
  const [paying, setPaying] = useState<BillRow | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <div className="space-y-3">
      {canCreate && <div className="flex justify-end"><button type="button" className="btn btn-primary" onClick={() => setAdding(true)}><Plus className="h-4 w-4" aria-hidden /> Add bill</button></div>}
      {error && <p role="alert" className="text-sm text-[var(--danger-text,#b42318)]">{error}</p>}
      {rows.length === 0 ? <div className="card p-10 text-center text-sm text-muted">No bills yet.</div> : (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-default bg-surface-subtle text-left text-xs font-medium uppercase tracking-wide text-muted">
              <tr><th className="px-4 py-3">Supplier / bill</th><th className="px-3 py-3">Due</th><th className="px-3 py-3 text-right">Total</th><th className="px-3 py-3 text-right">Balance</th><th className="px-3 py-3">Status</th><th className="px-3 py-3" /></tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {rows.map((b) => (
                <tr key={b.id} className="align-top">
                  <td className="px-4 py-3"><p className="font-medium text-primary">{b.supplier}</p><p className="text-xs text-muted">#{b.billNo} · {b.billDate}{b.description ? ` · ${b.description}` : ""}</p></td>
                  <td className="px-3 py-3 whitespace-nowrap text-secondary">{b.dueDate}</td>
                  <td className="px-3 py-3 text-right tabular-nums text-secondary">{aed(b.total)}</td>
                  <td className="px-3 py-3 text-right font-medium tabular-nums text-primary">{aed(b.balance)}</td>
                  <td className="px-3 py-3"><Badge color={COLOR[b.status]} dot>{BILL_STATUS_LABELS[b.status]}</Badge></td>
                  <td className="px-3 py-3">
                    <div className="flex justify-end gap-1.5">
                      {b.balance > 0 && canPay && <button type="button" className="btn btn-secondary" onClick={() => setPaying(b)}><CreditCard className="h-4 w-4" aria-hidden /> Pay</button>}
                      {b.paymentCount === 0 && canDelete && (
                        <button type="button" className="rounded-md p-1.5 text-subtle hover:bg-surface-hover hover:text-secondary" aria-label="Delete bill" disabled={pending}
                          onClick={() => start(async () => { setError(null); const fd = new FormData(); fd.set("id", b.id); const r = await deleteBillAction(fd); if (r.error) setError(r.error); })}><Trash2 className="h-4 w-4" /></button>
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
    </div>
  );
}
