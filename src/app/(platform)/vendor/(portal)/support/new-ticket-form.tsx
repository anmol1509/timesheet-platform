"use client";

import { useActionState, useRef } from "react";
import { keepInput } from "@/lib/vendor/keepInput";
import { createTicketAction } from "./actions";
import { Select } from "@/components/ui/Select";

type State = { error: string | null; ok?: boolean; id?: string };

export function NewTicketForm() {
  const ref = useRef<HTMLFormElement>(null);
  const [state, action, pending] = useActionState(
    async (p: State, fd: FormData) => { const r = await createTicketAction(p, fd); if (r.ok) ref.current?.reset(); return r; },
    { error: null } as State
  );
  return (
    <form ref={ref} onSubmit={keepInput(action)} className="card space-y-3 p-5">
      <h2 className="text-sm font-semibold text-primary">Send us a message</h2>
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="block"><span className="mb-1 block text-xs font-medium text-muted">Type</span><Select name="kind" defaultValue="FEEDBACK" searchable={false} options={[{ value: "FEEDBACK", label: "Feedback" }, { value: "COMPLAINT", label: "Complaint" }]} triggerClassName="w-full" /></label>
        <label className="block sm:col-span-2"><span className="mb-1 block text-xs font-medium text-muted">Subject *</span><input name="subject" required maxLength={120} className="input w-full" /></label>
      </div>
      <label className="block"><span className="mb-1 block text-xs font-medium text-muted">Message *</span><textarea name="message" required rows={4} maxLength={4000} className="input w-full" /></label>
      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" className="btn btn-primary" disabled={pending}>{pending ? "Sending…" : "Send"}</button>
        {state.error && <p role="alert" className="text-sm text-[var(--error)]">{state.error}</p>}
        {state.ok && <span className="text-sm text-[var(--success)]">Sent. We&apos;ll reply here.</span>}
      </div>
    </form>
  );
}
