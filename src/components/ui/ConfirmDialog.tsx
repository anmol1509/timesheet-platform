"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogFooter } from "./Dialog";
import { Button } from "./Button";

/**
 * Confirm-then-act dialog.
 *
 * The dialog stays open while `onConfirm` runs and shows a spinner on the
 * button, so a slow action can't be fired twice. If it throws, or resolves to
 * `{ error: "…" }` (the shape server actions here return), the message appears
 * in the dialog and nothing closes; otherwise it closes once the action is
 * done. Actions that only start a form submit (`requestSubmit()`) return at
 * once and so close at once, as before.
 */
export function ConfirmDialog({
  trigger,
  title = "Are you sure?",
  description,
  confirmLabel = "Confirm",
  danger = true,
  onConfirm,
}: {
  trigger: (open: () => void) => React.ReactNode;
  title?: string;
  description: string;
  confirmLabel?: string;
  danger?: boolean;
  onConfirm: () => unknown;
}) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function change(next: boolean) {
    if (pending) return; // don't let Esc or a backdrop click hide a running action
    setOpen(next);
    if (!next) setError(null);
  }

  async function confirm() {
    setPending(true);
    setError(null);
    try {
      const result = await onConfirm();
      const message =
        result && typeof result === "object" && "error" in result && typeof (result as { error: unknown }).error === "string"
          ? (result as { error: string }).error
          : null;
      if (message) setError(message);
      else setOpen(false);
    } catch (e) {
      setError(e instanceof Error && e.message ? e.message : "That didn't work. Nothing was changed.");
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      {trigger(() => setOpen(true))}
      <Dialog open={open} onOpenChange={change}>
        <DialogContent title={title} description={description}>
          {error && (
            <p role="alert" className="mt-4 rounded-control border border-[var(--error-border)] bg-[var(--error-soft)] px-3 py-2 text-sm text-[var(--error)]">
              {error}
            </p>
          )}
          <DialogFooter>
            <Button variant="secondary" onClick={() => change(false)} disabled={pending}>
              Cancel
            </Button>
            <Button variant={danger ? "danger" : "primary"} onClick={confirm} loading={pending}>
              {confirmLabel}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
