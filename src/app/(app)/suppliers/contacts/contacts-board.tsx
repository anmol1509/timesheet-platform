"use client";

import { PhoneField } from "@/components/ui/PhoneField";
import { useActionState, useRef, useState, useTransition } from "react";
import { Trash2 } from "lucide-react";
import { Badge } from "@/components/Badge";
import { addContactAction, deleteContactAction, toggleContactAction } from "./actions";
import { NumberInput } from "@/components/ui/NumberInput";

type State = { error: string | null; ok?: boolean };
export type ContactRow = { id: string; department: string; personName: string; designation: string | null; phone: string | null; email: string | null; isActive: boolean };

export function ContactsBoard({ rows, canEdit, canDelete }: { rows: ContactRow[]; canEdit: boolean; canDelete: boolean }) {
  const ref = useRef<HTMLFormElement>(null);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [state, action, adding] = useActionState(async (p: State, fd: FormData) => { const r = await addContactAction(p, fd); if (r.ok) ref.current?.reset(); return r; }, { error: null } as State);
  const run = (fn: (fd: FormData) => Promise<State>, id: string) => start(async () => { setError(null); const fd = new FormData(); fd.set("id", id); const r = await fn(fd); if (r.error) setError(r.error); });

  return (
    <div className="space-y-5">
      {canEdit && (
        <form ref={ref} action={action} className="card space-y-3 p-5">
          <h2 className="text-sm font-semibold text-primary">Add a contact</h2>
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="block"><span className="mb-1 block text-xs font-medium text-muted">Department *</span><input name="department" required placeholder="e.g. Dubai, Accounts" className="input w-full" /></label>
            <label className="block"><span className="mb-1 block text-xs font-medium text-muted">Person *</span><input name="personName" required className="input w-full" /></label>
            <label className="block"><span className="mb-1 block text-xs font-medium text-muted">Designation</span><input name="designation" className="input w-full" /></label>
            <label className="block"><span className="mb-1 block text-xs font-medium text-muted">Phone</span><PhoneField name="phone" /></label>
            <label className="block"><span className="mb-1 block text-xs font-medium text-muted">Email</span><input type="email" name="email" className="input w-full" /></label>
            <label className="block"><span className="mb-1 block text-xs font-medium text-muted">Order (lower first)</span><NumberInput name="sortOrder" defaultValue={0} className="w-full" /></label>
          </div>
          <div className="flex flex-wrap items-center gap-3"><button type="submit" className="btn btn-primary" disabled={adding}>{adding ? "Adding…" : "Add contact"}</button>{state.error && <p role="alert" className="text-sm text-[var(--error)]">{state.error}</p>}</div>
        </form>
      )}
      {error && <p role="alert" className="text-sm text-[var(--error)]">{error}</p>}
      {rows.length === 0 ? <div className="empty-state"><p className="text-sm text-muted">No contacts yet. Suppliers see nothing under &ldquo;Who to contact&rdquo; until you add one.</p></div> : (
        <ul className="card divide-y divide-[var(--border)] overflow-hidden">
          {rows.map((c) => (
            <li key={c.id} className={`flex flex-wrap items-center justify-between gap-3 px-5 py-3 text-sm ${c.isActive ? "" : "opacity-60"}`}>
              <span className="min-w-0"><span className="text-xs font-medium tracking-wide text-muted uppercase">{c.department}</span><span className="block font-medium text-primary">{c.personName}{c.designation && <span className="font-normal text-muted"> · {c.designation}</span>}</span><span className="block text-xs text-muted">{[c.phone, c.email].filter(Boolean).join(" · ")}</span></span>
              <span className="flex items-center gap-3">
                <Badge color={c.isActive ? "green" : "slate"} dot>{c.isActive ? "Shown" : "Hidden"}</Badge>
                {canEdit && <button type="button" disabled={pending} className="text-xs font-medium text-[var(--brand-primary)] hover:underline" onClick={() => run(toggleContactAction, c.id)}>{c.isActive ? "Hide" : "Show"}</button>}
                {canDelete && <button type="button" disabled={pending} aria-label="Delete contact" className="rounded-md p-1.5 text-subtle hover:bg-surface-hover hover:text-secondary" onClick={() => { if (confirm(`Delete ${c.personName}?`)) run(deleteContactAction, c.id); }}><Trash2 className="h-4 w-4" /></button>}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
