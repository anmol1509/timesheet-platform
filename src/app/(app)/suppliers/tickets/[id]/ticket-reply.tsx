"use client";

import { useActionState, useRef, useTransition } from "react";
import { replyToTicketAction, setTicketStatusAction } from "../actions";

type State = { error: string | null; ok?: boolean };

export function TicketReply({ ticketId, status, canReply }: { ticketId: string; status: string; canReply: boolean }) {
  const ref = useRef<HTMLFormElement>(null);
  const [pending, start] = useTransition();
  const [state, action, sending] = useActionState(
    async (p: State, fd: FormData) => { const r = await replyToTicketAction(p, fd); if (r.ok) ref.current?.reset(); return r; },
    { error: null } as State
  );
  if (!canReply) return null;
  const setStatus = (s: "OPEN" | "CLOSED") => start(async () => { const fd = new FormData(); fd.set("id", ticketId); fd.set("status", s); await setTicketStatusAction(fd); });
  return (
    <div className="space-y-3">
      {status !== "CLOSED" && (
        <form ref={ref} action={action} className="card space-y-3 p-5">
          <input type="hidden" name="ticketId" value={ticketId} />
          <label className="block"><span className="mb-1 block text-xs font-medium text-muted">Reply (the supplier will see this)</span><textarea name="body" required rows={4} maxLength={4000} className="input w-full" /></label>
          <div className="flex flex-wrap items-center gap-3"><button type="submit" className="btn btn-primary" disabled={sending}>{sending ? "Sending…" : "Send reply"}</button>{state.error && <p role="alert" className="text-sm text-[var(--error)]">{state.error}</p>}</div>
        </form>
      )}
      <button type="button" className="btn btn-secondary" disabled={pending} onClick={() => setStatus(status === "CLOSED" ? "OPEN" : "CLOSED")}>{status === "CLOSED" ? "Reopen" : "Close conversation"}</button>
    </div>
  );
}
