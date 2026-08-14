"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { Dialog, DialogContent, DialogFooter } from "@/components/ui/Dialog";
import { useToastActions } from "@/components/ui/Toast";
import {
  deactivateEmployeesAction,
  deleteEmployeesAction,
  type DeleteEmployeesResult,
} from "./actions";

/**
 * Delete control for one employee or a whole selection.
 *
 * Employees carrying payroll history can't be removed, so this is a two-step
 * flow: confirm, then — if the server refused some of them — show exactly who
 * was refused and why, and offer deactivation as the way forward. The refusal
 * is the useful half of the interaction, so it gets a real dialog rather than
 * an error toast that scrolls away.
 */
export function DeleteEmployeesButton({
  ids,
  label,
  variant = "row",
  onDone,
}: {
  ids: string[];
  /** Names the target in the confirm text: a person's name, or "3 employees". */
  label: string;
  variant?: "row" | "bulk";
  onDone?: () => void;
}) {
  const router = useRouter();
  const toast = useToastActions();
  const [pending, startTransition] = useTransition();
  const [confirming, setConfirming] = useState(false);
  const [blocked, setBlocked] = useState<DeleteEmployeesResult["blocked"]>([]);

  function runDelete() {
    setConfirming(false);
    startTransition(async () => {
      const result = await deleteEmployeesAction(ids);

      if (result.deleted > 0) {
        toast.success(
          `Deleted ${result.deleted} employee${result.deleted === 1 ? "" : "s"}.`
        );
        onDone?.();
        router.refresh();
      }
      if (result.blocked.length > 0) setBlocked(result.blocked);
    });
  }

  function runDeactivate() {
    const blockedIds = blocked.map((b) => b.id);
    setBlocked([]);
    startTransition(async () => {
      const { deactivated } = await deactivateEmployeesAction(blockedIds);
      toast.success(
        `Deactivated ${deactivated} employee${deactivated === 1 ? "" : "s"}.`,
        "Their records and history are unchanged."
      );
      onDone?.();
      router.refresh();
    });
  }

  return (
    <>
      <button
        type="button"
        disabled={pending || ids.length === 0}
        onClick={() => setConfirming(true)}
        className={
          variant === "bulk"
            ? "inline-flex items-center gap-1.5 rounded-control border border-[var(--error-border)] bg-[var(--error-soft)] px-2.5 py-1 text-xs font-medium text-[var(--error)] transition hover:brightness-95 disabled:opacity-50"
            : "inline-flex items-center gap-1 text-xs font-medium text-[var(--error)] transition hover:underline disabled:opacity-50"
        }
      >
        <Trash2 className="h-3.5 w-3.5" aria-hidden />
        Delete
      </button>

      <Dialog open={confirming} onOpenChange={setConfirming}>
        <DialogContent
          title="Confirm delete"
          description={`Delete ${label}? Any documents, skills and photos on file go too. Employees with timesheet or attendance history can't be deleted — you'll be offered to deactivate those instead.`}
        >
          <DialogFooter>
            <button
              type="button"
              onClick={() => setConfirming(false)}
              className="btn btn-secondary px-3"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={runDelete}
              className="rounded-lg bg-red-600 px-3 py-2 text-sm font-medium text-white transition hover:bg-red-700"
            >
              Delete
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={blocked.length > 0} onOpenChange={() => setBlocked([])}>
        <DialogContent
          title={
            blocked.length === 1 ? "This employee was kept" : "Some employees were kept"
          }
          description="Deleting them would break payroll history that has already been billed. Deactivating takes them off the active roster and keeps every record intact."
        >
          <ul className="max-h-56 space-y-1.5 overflow-y-auto">
            {blocked.map((b) => (
              <li
                key={b.id}
                className="rounded-control border border-default bg-surface-sunken px-3 py-2"
              >
                <span className="block text-sm text-primary">
                  {b.name}{" "}
                  <span className="tabular text-xs text-muted">{b.employeeIdNo}</span>
                </span>
                <span className="block text-xs text-muted">{b.reason}</span>
              </li>
            ))}
          </ul>
          <DialogFooter>
            <button
              type="button"
              onClick={() => setBlocked([])}
              className="btn btn-secondary px-3"
            >
              Leave them active
            </button>
            <button type="button" onClick={runDeactivate} className="btn btn-primary px-3">
              Deactivate {blocked.length === 1 ? "" : `all ${blocked.length}`}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
