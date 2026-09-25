"use client";

import { useActionState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2 } from "lucide-react";
import { markJoinedAction } from "./actions";

type State = { error: string | null; ok?: boolean };

export function JoinPanel({
  candidate,
}: {
  candidate: { id: string; readyToJoin: boolean; joined: boolean; joiningDate: Date | null; employeeId: string | null };
}) {
  const router = useRouter();
  const [state, action, pending] = useActionState(
    async (_prev: State, fd: FormData) => {
      fd.set("id", candidate.id);
      const res = await markJoinedAction({ error: null }, fd);
      if (res.ok) router.refresh();
      return res;
    },
    { error: null } as State
  );

  if (candidate.joined) {
    return (
      <div className="flex items-center gap-2 rounded-lg bg-[var(--success-soft)] px-4 py-3 text-sm text-[var(--success-text,#067647)]">
        <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden />
        Joined{candidate.joiningDate ? ` on ${new Date(candidate.joiningDate).toLocaleDateString()}` : ""}
        {candidate.employeeId ? ` · Employee ${candidate.employeeId}` : ""}
      </div>
    );
  }

  if (!candidate.readyToJoin) {
    return (
      <div className="rounded-lg bg-surface-subtle px-4 py-3 text-sm text-muted">
        Not ready to join yet — every stage below must be completed first.
      </div>
    );
  }

  return (
    <form action={action} className="flex flex-wrap items-end gap-3 rounded-lg bg-[var(--success-soft)] px-4 py-3">
      <div className="flex items-center gap-2 text-sm font-medium text-[var(--success-text,#067647)]">
        <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden /> Ready to join
      </div>
      <label className="block">
        <span className="mb-1 block text-xs font-medium text-muted">Joining date</span>
        <input type="date" name="joiningDate" defaultValue={new Date().toISOString().slice(0, 10)} className="input" />
      </label>
      <label className="block">
        <span className="mb-1 block text-xs font-medium text-muted">Employee ID (once created)</span>
        <input name="employeeId" className="input" placeholder="e.g. ABC-0142" />
      </label>
      <button type="submit" className="btn btn-primary" disabled={pending}>
        {pending ? "Saving…" : "Mark joined"}
      </button>
      {state.error && <p role="alert" className="text-sm text-[var(--error)]">{state.error}</p>}
    </form>
  );
}
