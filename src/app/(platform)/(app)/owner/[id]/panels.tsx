"use client";

import { useActionState } from "react";
import { addNoteAction, createInvoiceAction, creditsAction, recordPaymentAction, setStatusAction, syncCustomerAction, updateCustomerAction, voidInvoiceAction, type OwnerState } from "../actions";

const initial: OwnerState = { error: null };
const L = "block text-xs text-muted";
const I = "input mt-1 h-9 w-full text-sm";

/** One small form: hidden ids, the fields, a button, and what came back. */
function Form({ action, hidden, submit, busy, children, className, tone = "primary" }: { action: (prev: OwnerState, fd: FormData) => Promise<OwnerState>; hidden: Record<string, string>; submit: string; busy?: string; children?: React.ReactNode; className?: string; tone?: "primary" | "secondary" | "danger" }) {
  const [state, run, pending] = useActionState(action, initial);
  return (
    <form action={run} className={className ?? "space-y-3"}>
      {Object.entries(hidden).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
      {children}
      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" className={tone === "primary" ? "btn btn-primary btn-sm" : tone === "danger" ? "btn btn-secondary btn-sm text-[var(--error)]" : "btn btn-secondary btn-sm"} disabled={pending}>{pending ? busy ?? "Saving…" : submit}</button>
        {state.error && <p role="alert" className="text-xs text-[var(--error)]">{state.error}</p>}
        {state.ok && !state.error && <p className="text-xs text-[var(--success)]">Done.</p>}
      </div>
    </form>
  );
}

export const SyncForm = ({ id }: { id: string }) => <Form action={syncCustomerAction} hidden={{ id }} submit="Refresh usage" busy="Reading…" tone="secondary" />;
export const NoteForm = ({ id }: { id: string }) => (
  <Form action={addNoteAction} hidden={{ id }} submit="Add note"><textarea name="note" rows={2} placeholder="Something to remember about this customer" className="input w-full text-sm" /></Form>
);
export const VoidForm = ({ invoiceId }: { invoiceId: string }) => <Form action={voidInvoiceAction} hidden={{ invoiceId }} submit="Void" tone="danger" className="inline" />;

export function CreditsForms({ id, allowance }: { id: string; allowance: number }) {
  return (
    <div className="space-y-5">
      <Form action={creditsAction} hidden={{ id, kind: "grant" }} submit="Add credits" busy="Adding…">
        <div className="grid gap-3 sm:grid-cols-[8rem_1fr]">
          <label className={L}>Credits for this month<input name="credits" inputMode="numeric" placeholder="1000" className={I} /></label>
          <label className={L}>Note (optional)<input name="note" placeholder="e.g. Month-end payroll push" className={I} /></label>
        </div>
      </Form>
      <Form action={creditsAction} hidden={{ id, kind: "allowance" }} submit="Save allowance" tone="secondary">
        <label className={`${L} max-w-[12rem]`}>Credits every month<input name="credits" inputMode="numeric" defaultValue={allowance} className={I} /></label>
      </Form>
    </div>
  );
}

export function StatusForm({ id, status }: { id: string; status: string }) {
  return (
    <Form action={setStatusAction} hidden={{ id }} submit="Change status" tone="secondary">
      <label className={`${L} max-w-[14rem]`}>Status
        <select name="status" defaultValue={status} className={I}>
          <option value="TRIAL">Trial</option><option value="ACTIVE">Active</option><option value="SUSPENDED">Suspended (locks their people out)</option><option value="CHURNED">Left</option>
        </select>
      </label>
    </Form>
  );
}

export function InvoiceForm({ id, today }: { id: string; today: string }) {
  return (
    <Form action={createInvoiceAction} hidden={{ id }} submit="Raise invoice" busy="Raising…">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className={`${L} sm:col-span-2`}>What it is for<input name="description" placeholder="Platform subscription, November 2026" className={I} /></label>
        <label className={L}>Amount before VAT, AED<input name="amount" inputMode="decimal" className={I} /></label>
        <label className={L}>Due on<input name="dueDate" type="date" defaultValue={today} className={I} /></label>
        <label className="flex items-center gap-2 text-sm text-primary sm:col-span-2"><input type="checkbox" name="vat" defaultChecked className="h-4 w-4" /> Add 5% VAT</label>
      </div>
    </Form>
  );
}

export function PaymentForm({ id, invoiceId, left }: { id: string; invoiceId?: string; left?: number }) {
  return (
    <Form action={recordPaymentAction} hidden={{ id, ...(invoiceId ? { invoiceId } : {}) }} submit="Record payment" busy="Recording…" tone="secondary">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className={L}>Amount, AED<input name="amount" inputMode="decimal" defaultValue={left ? String(left) : ""} className={I} /></label>
        <label className={L}>Received on<input name="receivedOn" type="date" className={I} /></label>
        <label className={L}>How<select name="method" className={I}><option value="BANK">Bank transfer</option><option value="CASH">Cash</option><option value="CHEQUE">Cheque</option><option value="CARD">Card</option></select></label>
        <label className={L}>Reference<input name="reference" placeholder="Transfer no." className={I} /></label>
      </div>
    </Form>
  );
}

export function EditForm({ c }: { c: { id: string; name: string; contactName: string | null; contactEmail: string; contactPhone: string | null; address: string | null; trn: string | null; plan: string; planPriceAed: string; billingCycle: string; renewsOn: string; aiRateAed: string; notes: string | null; hosting: string; appUrl: string | null; supabaseRef: string | null; vercelProject: string | null } }) {
  return (
    <Form action={updateCustomerAction} hidden={{ id: c.id }} submit="Save details">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className={L}>Company name<input name="name" defaultValue={c.name} className={I} /></label>
        <label className={L}>TRN<input name="trn" defaultValue={c.trn ?? ""} className={I} /></label>
        <label className={L}>Contact person<input name="contactName" defaultValue={c.contactName ?? ""} className={I} /></label>
        <label className={L}>Contact email<input name="contactEmail" type="email" defaultValue={c.contactEmail} className={I} /></label>
        <label className={L}>Phone<input name="contactPhone" defaultValue={c.contactPhone ?? ""} className={I} /></label>
        <label className={L}>Address<input name="address" defaultValue={c.address ?? ""} className={I} /></label>
        <label className={L}>Plan<input name="plan" defaultValue={c.plan} className={I} /></label>
        <label className={L}>Price in AED<input name="planPriceAed" defaultValue={c.planPriceAed} inputMode="decimal" className={I} /></label>
        <label className={L}>Billed<select name="billingCycle" defaultValue={c.billingCycle} className={I}><option value="MONTHLY">Monthly</option><option value="YEARLY">Yearly</option></select></label>
        <label className={L}>Renews on<input name="renewsOn" type="date" defaultValue={c.renewsOn} className={I} /></label>
        <label className={L}>One AI credit is worth, in AED<input name="aiRateAed" defaultValue={c.aiRateAed} inputMode="decimal" className={I} /></label>
        {c.hosting === "DEDICATED" && (<>
          <label className={L}>Deployment address<input name="appUrl" defaultValue={c.appUrl ?? ""} className={I} /></label>
          <label className={L}>Database project reference<input name="supabaseRef" defaultValue={c.supabaseRef ?? ""} className={I} /></label>
          <label className={L}>Vercel project<input name="vercelProject" defaultValue={c.vercelProject ?? ""} className={I} /></label>
        </>)}
        <label className={`${L} sm:col-span-2`}>Notes<textarea name="notes" rows={3} defaultValue={c.notes ?? ""} className="input mt-1 w-full text-sm" /></label>
      </div>
    </Form>
  );
}
