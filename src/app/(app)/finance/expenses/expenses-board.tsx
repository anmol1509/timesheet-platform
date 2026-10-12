"use client";

import { useActionState, useRef, useState, useTransition } from "react";
import { Paperclip, Plus, Trash2, ScanLine, Loader2 } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/Dialog";
import { Select } from "@/components/ui/Select";
import { Badge, type BadgeColor } from "@/components/Badge";
import { EXPENSE_CATEGORIES, PAYMENT_METHODS } from "@/lib/financeConstants";
import Link from "next/link";
import { AttachmentUploader, type AttachmentRow } from "@/components/AttachmentUploader";
import { createExpenseAction, deleteExpenseAction, markReimbursedAction } from "../actions";
import { ComboSelect } from "@/components/ui/ComboSelect";
import { DatePicker } from "@/components/ui/DatePicker";
import { NumberInput } from "@/components/ui/NumberInput";
import { MAX_UPLOAD_BYTES, MAX_UPLOAD_LABEL } from "@/lib/constants";
import type { ExtractedReceiptFields } from "@/app/api/expenses/extract-receipt/route";

type State = { error: string | null; ok?: boolean };
export type ExpenseRow = { id: string; date: string; category: string; description: string; total: number; paidTo: string | null; method: string | null; project: string | null; status: string; by: string; note: string | null; outOfPocket: boolean; reimbursed: boolean; branchId: string; files: AttachmentRow[] };
const STATUS: Record<string, { label: string; color: BadgeColor }> = { PENDING: { label: "Pending", color: "amber" }, APPROVED: { label: "Approved", color: "green" }, REJECTED: { label: "Rejected", color: "red" } };
const aed = (n: number) => n.toLocaleString("en-AE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const TODAY = new Date().toISOString().slice(0, 10);

function NewExpenseForm({ projects, onDone }: { projects: { id: string; name: string }[]; onDone: () => void }) {
  const [allowDuplicate, setAllowDuplicate] = useState(false);
  const [state, action, pending] = useActionState(
    async (prev: State, fd: FormData) => {
      const res = await createExpenseAction(prev, fd);
      if (res.ok) onDone();
      else if (res.error?.startsWith("DUPLICATE:")) setAllowDuplicate(true);
      return res;
    },
    { error: null } as State
  );
  const dup = state.error?.startsWith("DUPLICATE:");

  // AI receipt scan — fills the fields below, which a person still reviews
  // and submits themselves; nothing here posts an expense on its own.
  const fileRef = useRef<HTMLInputElement>(null);
  const [scanning, setScanning] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const [extracted, setExtracted] = useState<ExtractedReceiptFields>({});
  // Bumped after a scan so the (uncontrolled) fields below remount and pick
  // up their new `defaultValue` — same pattern as elsewhere in this app for
  // programmatically filling components that only read defaultValue once.
  const [formKey, setFormKey] = useState(0);

  async function handleScan() {
    const file = fileRef.current?.files?.[0];
    if (!file) return;
    if (file.size > MAX_UPLOAD_BYTES) {
      setScanError(`"${file.name}" is too large — max ${MAX_UPLOAD_LABEL}.`);
      if (fileRef.current) fileRef.current.value = "";
      return;
    }
    setScanning(true);
    setScanError(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/expenses/extract-receipt", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) {
        setScanError(data.error || "Couldn't read this receipt.");
        return;
      }
      setExtracted(data);
      setFormKey((k) => k + 1);
    } catch {
      setScanError("Couldn't read this receipt. Enter the details manually.");
    } finally {
      setScanning(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <form action={action} className="mt-4 space-y-3">
      {allowDuplicate && <input type="hidden" name="allowDuplicate" value="1" />}

      <div className="flex items-center gap-2 rounded-lg border border-dashed border-default bg-surface-subtle px-3 py-2.5">
        <ScanLine className="h-4 w-4 shrink-0 text-[var(--brand-primary)]" aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium text-primary">Scan a receipt to fill this in</p>
          <p className="text-xs text-subtle">Photo or PDF — you still review everything before submitting.</p>
        </div>
        <input ref={fileRef} type="file" accept="image/*,application/pdf" className="hidden" id="receipt-scan-input" onChange={handleScan} disabled={scanning} />
        <label htmlFor="receipt-scan-input" className={`btn btn-secondary shrink-0 ${scanning ? "pointer-events-none opacity-60" : "cursor-pointer"}`}>
          {scanning ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <ScanLine className="h-4 w-4" aria-hidden />}
          {scanning ? "Reading…" : "Scan receipt"}
        </label>
      </div>
      {scanError && <p role="alert" className="text-sm text-[var(--error)]">{scanError}</p>}

      <div className="grid grid-cols-2 gap-3">
        <label className="block"><span className="mb-1 block text-xs font-medium text-muted">Date *</span><DatePicker key={`date-${formKey}`} name="date" defaultValue={extracted.date || TODAY} required className="w-full" /></label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-muted">Category</span>
          <ComboSelect key={`category-${formKey}`} name="category" options={EXPENSE_CATEGORIES.filter((c) => c !== "Other")} defaultValue={extracted.category || undefined} required />
          <datalist id="expense-categories">{EXPENSE_CATEGORIES.map((c) => <option key={c} value={c} />)}</datalist>
        </label>
      </div>
      <label className="block"><span className="mb-1 block text-xs font-medium text-muted">Description *</span><input key={`description-${formKey}`} name="description" defaultValue={extracted.description || ""} required className="input w-full" /></label>
      <div className="grid grid-cols-2 gap-3">
        <label className="block"><span className="mb-1 block text-xs font-medium text-muted">Amount (AED, before VAT) *</span><NumberInput key={`amount-${formKey}`} name="amount" defaultValue={extracted.amount || undefined} required min={0} step={0.01} className="w-full" /></label>
        <label className="block"><span className="mb-1 block text-xs font-medium text-muted">VAT (AED)</span><NumberInput key={`vat-${formKey}`} name="vatAmount" defaultValue={extracted.vatAmount || "0"} min={0} step={0.01} className="w-full" /></label>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <label className="block"><span className="mb-1 block text-xs font-medium text-muted">Paid to</span><input key={`paidTo-${formKey}`} name="paidTo" defaultValue={extracted.vendor || ""} className="input w-full" /></label>
        <label className="block"><span className="mb-1 block text-xs font-medium text-muted">Method</span><Select name="paymentMethod" defaultValue="" searchable={false} options={[{ value: "", label: "—" }, ...PAYMENT_METHODS.map((m) => ({ value: m, label: m.charAt(0) + m.slice(1).toLowerCase() }))]} /></label>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <label className="block"><span className="mb-1 block text-xs font-medium text-muted">Reference / receipt no.</span><input key={`reference-${formKey}`} name="reference" defaultValue={extracted.reference || ""} className="input w-full" /></label>
        <label className="block"><span className="mb-1 block text-xs font-medium text-muted">Project (optional)</span><Select name="projectId" defaultValue="" placeholder="—" options={[{ value: "", label: "—" }, ...projects.map((p) => ({ value: p.id, label: p.name }))]} /></label>
      </div>
      <label className="flex items-center gap-2 text-sm text-secondary"><input type="checkbox" name="outOfPocket" value="1" className="h-4 w-4" /> Paid out of pocket (owed back to the person who submits it)</label>
      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" className="btn btn-primary" disabled={pending}>{pending ? "Saving…" : dup ? "Keep both — submit anyway" : "Submit expense"}</button>
        {state.error && <p role="alert" className={dup ? "text-sm text-[var(--warning)]" : "text-sm text-[var(--danger-text,#b42318)]"}>{state.error.replace("DUPLICATE: ", "")}</p>}
      </div>
    </form>
  );
}

export function ExpensesBoard({ rows, projects, canCreate, canApprove, canDelete }: { rows: ExpenseRow[]; projects: { id: string; name: string }[]; canCreate: boolean; canApprove: boolean; canDelete: boolean }) {
  const [open, setOpen] = useState(false);
  const [filing, setFiling] = useState<ExpenseRow | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const run = (fn: (fd: FormData) => Promise<State>, fields: Record<string, string>, after?: () => void) =>
    start(async () => {
      setError(null);
      const fd = new FormData();
      for (const [k, v] of Object.entries(fields)) fd.set(k, v);
      const res = await fn(fd);
      if (res.error) setError(res.error);
      else after?.();
    });

  return (
    <div className="space-y-3">
      {canCreate && <div className="flex justify-end"><button type="button" className="btn btn-primary" onClick={() => setOpen(true)}><Plus className="h-4 w-4" aria-hidden /> New expense</button></div>}
      {error && <p role="alert" className="text-sm text-[var(--danger-text,#b42318)]">{error}</p>}
      {rows.length === 0 ? (
        <div className="card p-10 text-center text-sm text-muted">No expenses match.</div>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-default bg-surface-subtle text-left text-xs font-medium uppercase tracking-wide text-muted">
              <tr><th className="px-4 py-3">Date</th><th className="px-4 py-3">Expense</th><th className="px-4 py-3 text-right">Total (AED)</th><th className="px-4 py-3">Status</th><th className="px-4 py-3" /></tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {rows.map((r) => (
                <tr key={r.id} className="align-top">
                  <td className="px-4 py-3 whitespace-nowrap text-secondary">{r.date}</td>
                  <td className="px-4 py-3">
                    <p className="font-medium text-primary">{r.category}</p>
                    <p className="text-xs text-secondary">{r.description}</p>
                    <p className="text-xs text-muted">{[r.paidTo && `to ${r.paidTo}`, r.method?.toLowerCase(), r.project, `by ${r.by}`].filter(Boolean).join(" · ")}</p>
                    {r.outOfPocket && <p className="mt-1"><Badge color={r.reimbursed ? "green" : "amber"} dot>{r.reimbursed ? "Reimbursed" : "Owed to " + r.by}</Badge></p>}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-primary">{aed(r.total)}</td>
                  <td className="px-4 py-3"><Badge color={STATUS[r.status]?.color ?? "slate"} dot>{STATUS[r.status]?.label ?? r.status}</Badge>{r.note && <p className="mt-0.5 max-w-40 truncate text-xs text-muted" title={r.note}>{r.note}</p>}</td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1.5">
                      <button type="button" className="btn btn-secondary" onClick={() => setFiling(r)} aria-label="Receipts"><Paperclip className="h-4 w-4" aria-hidden />{r.files.length > 0 ? r.files.length : ""}</button>
                      {r.outOfPocket && r.status === "APPROVED" && !r.reimbursed && canApprove && (
                        <button type="button" className="btn btn-secondary" disabled={pending} onClick={() => run(markReimbursedAction, { id: r.id })}>Mark reimbursed</button>
                      )}
                      {r.status === "PENDING" && <Link href="/approvals?type=EXPENSE" className="btn btn-secondary">Review in Approvals</Link>}
                      {r.status !== "APPROVED" && canDelete && (
                        <button type="button" className="rounded-md p-1.5 text-subtle hover:bg-surface-hover hover:text-secondary" aria-label="Delete expense" disabled={pending} onClick={() => run(deleteExpenseAction, { id: r.id })}><Trash2 className="h-4 w-4" /></button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent title="New expense" description="Goes to an approver before it counts."><NewExpenseForm projects={projects} onDone={() => setOpen(false)} /></DialogContent>
      </Dialog>
      <Dialog open={filing !== null} onOpenChange={(o) => !o && setFiling(null)}>
        {filing && (
          <DialogContent title="Receipts" description={`${filing.category} — AED ${aed(filing.total)}`}>
            <div className="mt-4">
              <AttachmentUploader
                entityType="EXPENSE"
                entityId={filing.id}
                entityBranchId={filing.branchId}
                revalidate="/finance/expenses"
                docTypeOptions={[{ value: "RECEIPT", label: "Receipt" }, { value: "INVOICE", label: "Invoice" }, { value: "OTHER", label: "Other" }]}
                attachments={filing.files}
              />
            </div>
          </DialogContent>
        )}
      </Dialog>
    </div>
  );
}
