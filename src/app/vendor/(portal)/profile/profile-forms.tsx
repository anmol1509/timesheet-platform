"use client";

import { keepInput } from "@/lib/vendor/keepInput";
import { useActionState, useState, useTransition } from "react";
import { Paperclip } from "lucide-react";
import { Badge } from "@/components/Badge";
import { cancelChangeAction, requestChangeAction, uploadDocumentAction } from "./actions";

type State = { error: string | null; ok?: boolean };
export type PendingRow = { id: string; kind: string; status: string; note: string | null; changes: { label: string; value: string }[] };
type Vals = Record<string, string>;

const F = ({ t, children }: { t: string; children: React.ReactNode }) => <label className="block"><span className="mb-1 block text-xs font-medium text-muted">{t}</span>{children}</label>;

function ChangeForm({ kind, title, hint, values, fields, pending: hasPending }: { kind: "BANK" | "CONTACT"; title: string; hint: string; values: Vals; fields: [string, string][]; pending: boolean }) {
  const [state, action, busy] = useActionState(async (p: State, fd: FormData) => requestChangeAction(p, fd), { error: null } as State);
  return (
    <form onSubmit={keepInput(action)} className="card space-y-3 p-5">
      <input type="hidden" name="kind" value={kind} />
      <div><h2 className="text-sm font-semibold text-primary">{title}</h2><p className="mt-0.5 text-xs text-muted">{hint}</p></div>
      <div className="grid gap-3 sm:grid-cols-2">
        {fields.map(([name, label]) => <F key={name} t={label}><input name={name} defaultValue={values[name]} disabled={hasPending} className="input w-full" /></F>)}
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" className="btn btn-secondary" disabled={busy || hasPending}>{busy ? "Sending…" : "Request this change"}</button>
        {hasPending && <span className="text-xs text-muted">You have a change waiting for approval below.</span>}
        {state.error && <p role="alert" className="text-sm text-[var(--error)]">{state.error}</p>}
        {state.ok && <span className="text-sm text-[var(--success)]">Sent for approval</span>}
      </div>
    </form>
  );
}

export function ProfileForms({ contact, bank, maskedIban, requests, docTypes, docs }: {
  contact: Vals; bank: Vals; maskedIban: string; requests: PendingRow[]; docTypes: { value: string; label: string }[];
  docs: { id: string; type: string; filename: string; expiry: string | null; days: number | null }[];
}) {
  const [pending, start] = useTransition();
  const [docState, docAction, uploading] = useActionState(async (p: State, fd: FormData) => uploadDocumentAction(p, fd), { error: null } as State);
  const [error, setError] = useState<string | null>(null);
  const has = (kind: string) => requests.some((r) => r.kind === kind && r.status === "PENDING");

  return (
    <>
      {requests.length > 0 && (
        <section className="card overflow-hidden">
          <div className="border-b border-default px-5 py-3"><h2 className="text-sm font-semibold text-primary">Your change requests</h2></div>
          {error && <p role="alert" className="px-5 pt-3 text-sm text-[var(--error)]">{error}</p>}
          <ul className="divide-y divide-[var(--border)]">
            {requests.map((r) => (
              <li key={r.id} className="px-5 py-3 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-medium text-primary">{r.kind === "BANK" ? "Bank details" : "Contact details"}</span>
                  <span className="flex items-center gap-3">
                    <Badge color={r.status === "REJECTED" ? "red" : "amber"} dot>{r.status === "REJECTED" ? "Not approved" : "Awaiting approval"}</Badge>
                    {r.status === "PENDING" && <button type="button" disabled={pending} className="text-xs font-medium text-[var(--error)] hover:underline" onClick={() => start(async () => { setError(null); const fd = new FormData(); fd.set("id", r.id); const res = await cancelChangeAction(fd); if (res.error) setError(res.error); })}>Cancel request</button>}
                  </span>
                </div>
                <ul className="mt-1.5 space-y-0.5 text-xs text-muted">{r.changes.map((c) => <li key={c.label}>{c.label}: <span className="text-secondary">{c.value}</span></li>)}</ul>
                {r.status === "REJECTED" && r.note && <p className="mt-1.5 text-xs text-[var(--error)]">Reason: {r.note}</p>}
              </li>
            ))}
          </ul>
        </section>
      )}

      <ChangeForm kind="CONTACT" title="Contact details" hint="Your mobile number is also the number you sign in with, so changing it needs our approval."
        values={contact} pending={has("CONTACT")}
        fields={[["contactPerson", "Contact person"], ["contactPhone", "Mobile (sign-in number)"], ["contactEmail", "Email"], ["phone", "Other phone"], ["poBox", "P.O. Box"], ["location", "Location"]]} />
      <ChangeForm kind="BANK" title="Bank details" hint={`Payments go to this account${maskedIban ? ` (IBAN ${maskedIban})` : ""}. For your protection every change is checked by our team before it takes effect.`}
        values={bank} pending={has("BANK")}
        fields={[["bankName", "Bank"], ["iban", "IBAN"], ["bankAccountName", "Account name"], ["bankAccountNumber", "Account number"], ["bankEmirate", "Bank emirate"]]} />

      <section className="card p-5">
        <h2 className="text-sm font-semibold text-primary">Company documents</h2>
        <p className="mt-0.5 text-xs text-muted">Keep your licence, permit and insurance up to date. We&apos;ll see what you upload.</p>
        {docs.length === 0 ? <p className="mt-3 text-sm text-muted">No documents yet.</p> : (
          <ul className="mt-3 divide-y divide-[var(--border)]">
            {docs.map((d) => (
              <li key={d.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                <a href={`/vendor/files/${d.id}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-primary hover:underline"><Paperclip className="h-3.5 w-3.5 text-subtle" aria-hidden />{d.type}<span className="text-xs text-muted">· {d.filename}</span></a>
                {d.expiry && <Badge color={d.days !== null && d.days < 0 ? "red" : d.days !== null && d.days <= 30 ? "amber" : "green"}>{d.days !== null && d.days < 0 ? "Expired" : `Expires ${d.expiry}`}</Badge>}
              </li>
            ))}
          </ul>
        )}
        <form action={docAction} className="mt-4 space-y-3 border-t border-default pt-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <F t="Type"><select name="docType" required defaultValue="" className="input w-full"><option value="" disabled>Choose…</option>{docTypes.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}</select></F>
            <F t="Expiry date"><input type="date" name="expiryDate" className="input w-full" /></F>
            <F t="File (PDF, JPG, PNG)"><input type="file" name="file" required accept="application/pdf,image/jpeg,image/png" className="file-input w-full" /></F>
          </div>
          <div className="flex flex-wrap items-center gap-3"><button type="submit" className="btn btn-secondary" disabled={uploading}>{uploading ? "Uploading…" : "Upload document"}</button>{docState.error && <p role="alert" className="text-sm text-[var(--error)]">{docState.error}</p>}{docState.ok && <span className="text-sm text-[var(--success)]">Uploaded</span>}</div>
        </form>
      </section>
    </>
  );
}
