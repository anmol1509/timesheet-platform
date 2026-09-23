"use client";

import { useActionState, useRef } from "react";
import { requestLeaveAction } from "./actions";

export function RequestLeaveForm({ types }: { types: { id: string; name: string }[] }) {
  const ref = useRef<HTMLFormElement>(null);
  const [state, action, pending] = useActionState(
    async (prev: { error: string | null; ok?: boolean }, fd: FormData) => {
      const res = await requestLeaveAction(prev, fd);
      if (res.ok) ref.current?.reset();
      return res;
    },
    { error: null } as { error: string | null; ok?: boolean }
  );
  return (
    <form ref={ref} action={action} className="card space-y-3 p-4">
      <h2 className="text-sm font-semibold text-primary">Request leave</h2>
      <label className="block">
        <span className="mb-1 block text-xs font-medium text-muted">Type</span>
        <select name="leaveTypeId" required defaultValue="" className="input h-11 w-full">
          <option value="" disabled>Choose…</option>
          {types.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
      </label>
      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-muted">From</span>
          <input type="date" name="startDate" required className="input h-11 w-full" />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-muted">To (inclusive)</span>
          <input type="date" name="endDate" required className="input h-11 w-full" />
        </label>
      </div>
      <label className="block">
        <span className="mb-1 block text-xs font-medium text-muted">Reason (optional)</span>
        <input name="reason" maxLength={300} className="input h-11 w-full" />
      </label>
      <button type="submit" disabled={pending} className="btn btn-primary h-11 w-full">{pending ? "Sending…" : "Send request"}</button>
      {state.error && <p role="alert" className="text-sm text-[var(--danger-text,#b42318)]">{state.error}</p>}
      {state.ok && <p role="status" className="text-sm text-[var(--success-text,#067647)]">Request sent. Your office will review it.</p>}
    </form>
  );
}
