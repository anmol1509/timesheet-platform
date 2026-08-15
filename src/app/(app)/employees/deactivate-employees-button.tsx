"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { UserMinus } from "lucide-react";
import { Dialog, DialogContent, DialogFooter } from "@/components/ui/Dialog";
import { useToastActions } from "@/components/ui/Toast";
import { deactivateEmployeesAction } from "./actions";

/**
 * Takes a selection off the active roster without deleting anything.
 *
 * This is the ordinary end of a worker's time on the books — demobilised,
 * gone home, contract finished — and it keeps their timesheet and document
 * history intact. It existed only as the fallback offered when a delete was
 * refused, which meant the destructive action was the easy one to reach.
 */
export function DeactivateEmployeesButton({
  ids,
  onDone,
}: {
  ids: string[];
  onDone?: () => void;
}) {
  const router = useRouter();
  const toast = useToastActions();
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");

  function run() {
    setOpen(false);
    startTransition(async () => {
      const { deactivated } = await deactivateEmployeesAction(ids, reason);
      toast.success(
        `Deactivated ${deactivated} employee${deactivated === 1 ? "" : "s"}.`,
        "Their records and history are unchanged."
      );
      setReason("");
      onDone?.();
      router.refresh();
    });
  }

  return (
    <>
      <button
        type="button"
        disabled={pending || ids.length === 0}
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-control border border-default bg-surface px-2.5 py-1 text-xs font-medium text-secondary transition hover:bg-surface-hover disabled:opacity-50"
      >
        <UserMinus className="h-3.5 w-3.5" aria-hidden />
        Deactivate
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          title={`Deactivate ${ids.length} employee${ids.length === 1 ? "" : "s"}?`}
          description="They come off the active roster but keep every record — documents, timesheets and history are untouched. You can reactivate them from their profile."
        >
          <label className="block">
            <span className="field-label">Reason (optional)</span>
            <input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Demobilized, contract ended, returned home…"
              className="input w-full"
            />
          </label>
          <DialogFooter>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="btn btn-secondary px-3"
            >
              Cancel
            </button>
            <button type="button" onClick={run} className="btn btn-primary px-3">
              Deactivate
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
