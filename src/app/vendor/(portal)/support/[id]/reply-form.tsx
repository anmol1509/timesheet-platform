"use client";

import { useActionState, useRef } from "react";
import { keepInput } from "@/lib/vendor/keepInput";
import { replyTicketAction } from "../actions";

type State = { error: string | null; ok?: boolean };

export function ReplyForm({ ticketId }: { ticketId: string }) {
  const ref = useRef<HTMLFormElement>(null);
  const [state, action, pending] = useActionState(
    async (p: State, fd: FormData) => { const r = await replyTicketAction(p, fd); if (r.ok) ref.current?.reset(); return r; },
    { error: null } as State
  );
  return (
    <form ref={ref} onSubmit={keepInput(action)} className="card space-y-3 p-5">
      <input type="hidden" name="ticketId" value={ticketId} />
      <label className="block"><span className="mb-1 block text-xs font-medium text-muted">Your reply *</span><textarea name="body" required rows={3} maxLength={4000} className="input w-full" /></label>
      <div className="flex flex-wrap items-center gap-3"><button type="submit" className="btn btn-primary" disabled={pending}>{pending ? "Sending…" : "Send reply"}</button>{state.error && <p role="alert" className="text-sm text-[var(--error)]">{state.error}</p>}</div>
    </form>
  );
}
