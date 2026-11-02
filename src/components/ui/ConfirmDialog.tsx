"use client";

import { Alert } from "@/components/Alert";
import { useEffect, useRef, useState } from "react";
import { TriangleAlert, CircleHelp } from "lucide-react";
import { Dialog, DialogContent, DialogFooter } from "./Dialog";
import { Button } from "./Button";

/**
 * Confirm-then-act dialog. Destructive ones (`danger`) are press and hold.
 *
 * The dialog stays open while `onConfirm` runs and shows a spinner on the
 * button, so a slow action can't be fired twice. If it throws, or resolves to
 * `{ error: "…" }` (the shape server actions here return), the message appears
 * in the dialog and nothing closes; otherwise it closes once the action is
 * done, after a short tick. Actions that only start a form submit (`requestSubmit()`) return at
 * once and so close at once, as before.
 */
const HOLD_MS = 700;

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
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Destructive confirms are press and hold: a red fill crosses the button and the action runs when it completes.
  const [holding, setHolding] = useState(false);
  const [hint, setHint] = useState(false);
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (holdTimer.current) clearTimeout(holdTimer.current); }, []);

  function startHold() {
    if (pending || holdTimer.current) return;
    setHint(false);
    setHolding(true);
    holdTimer.current = setTimeout(() => {
      holdTimer.current = null;
      setHolding(false);
      void confirm();
    }, HOLD_MS);
  }
  function endHold() {
    if (!holdTimer.current) return;
    clearTimeout(holdTimer.current);
    holdTimer.current = null;
    setHolding(false);
    setHint(true);
  }

  function change(next: boolean) {
    if (pending) return; // don't let Esc or a backdrop click hide a running action
    setOpen(next);
    if (!next) { setError(null); setHint(false); }
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
      else {
        // Let the tick show before the dialog goes away.
        setSuccess(true);
        await new Promise((r) => setTimeout(r, 900));
        setOpen(false);
        setSuccess(false);
      }
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
        <DialogContent title={title} description={description} tone={danger ? "danger" : undefined} icon={danger ? <TriangleAlert className="h-[18px] w-[18px]" /> : <CircleHelp className="h-[18px] w-[18px]" />}>
          {error && (
            <Alert className="mt-4">{error}</Alert>
          )}
          <DialogFooter>
            {danger && (
              <p role="status" className={`mr-auto text-xs ${hint ? "text-[var(--error)]" : "text-subtle"}`}>
                {hint ? `Keep holding ${confirmLabel} until it fills.` : `Press and hold ${confirmLabel} to confirm.`}
              </p>
            )}
            <Button variant="secondary" onClick={() => change(false)} disabled={pending}>
              Cancel
            </Button>
            {danger ? (
              <Button
                variant="danger"
                className={holding ? "is-holding" : undefined}
                loading={pending}
                success={success}
                successLabel="Done"
                onPointerDown={(e) => { if (e.button === 0) startHold(); }}
                onPointerUp={endHold}
                onPointerLeave={endHold}
                onPointerCancel={endHold}
                onContextMenu={(e) => e.preventDefault()}
                onKeyDown={(e) => { if ((e.key === "Enter" || e.key === " ") && !e.repeat) { e.preventDefault(); startHold(); } }}
                onKeyUp={(e) => { if (e.key === "Enter" || e.key === " ") endHold(); }}
              >
                {confirmLabel}
              </Button>
            ) : (
              <Button variant="primary" onClick={confirm} loading={pending} success={success} successLabel="Done">
                {confirmLabel}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
