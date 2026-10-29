"use client";

import { useActionState, useState } from "react";
import { useRouter } from "next/navigation";
import { Ban, RotateCcw } from "lucide-react";
import { dropCandidateAction, reinstateCandidateAction } from "./actions";

import { Button } from "@/components/ui/Button";
type State = { error: string | null; ok?: boolean };

/**
 * Drops a candidate who won't be joining (withdrew, failed, didn't arrive) so they leave the queue and the reminders, or shows
 * that they were dropped, with a way to bring them back. Joined candidates can't be dropped.
 */
export function DropPanel({ candidateId, joined, droppedAt, droppedReason, canEdit = true }: { candidateId: string; joined: boolean; droppedAt: Date | null; droppedReason: string | null; canEdit?: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState(
    async (_p: State, fd: FormData) => {
      const res = await dropCandidateAction(_p, fd);
      if (res.ok) { setOpen(false); router.refresh(); }
      return res;
    },
    { error: null } as State,
  );

  if (droppedAt) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[var(--warning-border)] bg-[var(--warning-soft)] px-4 py-3">
        <p className="text-sm text-primary"><span className="font-medium">Dropped</span> on {new Date(droppedAt).toLocaleDateString("en-GB")}{droppedReason ? `: ${droppedReason}` : ""}. They are out of the queue and the reminders.</p>
        {canEdit && <form action={reinstateCandidateAction}>
          <input type="hidden" name="id" value={candidateId} />
          <button type="submit" className="btn btn-secondary btn-sm"><RotateCcw className="h-3.5 w-3.5" aria-hidden /> Bring back</button>
        </form>}
      </div>
    );
  }
  if (joined || !canEdit) return null;

  return open ? (
    <form action={action} className="flex flex-wrap items-start gap-2 rounded-lg border border-default bg-surface-subtle px-4 py-3">
      <input type="hidden" name="id" value={candidateId} />
      <input name="reason" required maxLength={200} placeholder="Why? e.g. withdrew, failed trade test, didn't arrive" aria-label="Reason for dropping" className="input min-w-0 flex-1" autoFocus />
      <Button size="btn-sm" type="submit" disabled={pending} loading={pending}>Drop candidate</Button>
      <button type="button" className="btn btn-secondary btn-sm" onClick={() => setOpen(false)}>Cancel</button>
      {state.error && <p role="alert" className="w-full text-sm text-[var(--error)]">{state.error}</p>}
    </form>
  ) : (
    <button type="button" className="inline-flex items-center gap-1 text-xs font-medium text-muted hover:text-primary hover:underline" onClick={() => setOpen(true)}>
      <Ban className="h-3.5 w-3.5" aria-hidden /> Won&rsquo;t be joining? Drop this candidate
    </button>
  );
}
