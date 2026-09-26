"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertOctagon } from "lucide-react";
import { Dialog, DialogContent, DialogFooter } from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Button";
import { resetAllAction } from "./actions";

export function ResetAllCard({ totalCount }: { totalCount: number }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="card flex flex-wrap items-center justify-between gap-3 border-[var(--error-border)] bg-[var(--error-soft)]/60 p-4">
      <div className="flex items-start gap-3">
        <AlertOctagon className="mt-0.5 h-5 w-5 shrink-0 text-[var(--error)]" />
        <div>
          <h3 className="text-sm font-semibold text-[var(--error)]">Reset All Modules</h3>
          <p className="mt-0.5 text-xs text-[var(--error)]">
            Deletes every module below in one shot, in the order that avoids conflicts. One transaction — either
            all {totalCount} records across every module go, or (on any error) none do.
          </p>
        </div>
      </div>
      <Button variant="danger" onClick={() => setOpen(true)} disabled={totalCount === 0} className="shrink-0">
        Reset Everything
      </Button>

      <ResetAllDialog open={open} totalCount={totalCount} onClose={() => setOpen(false)} />
    </div>
  );
}

function ResetAllDialog({
  open,
  totalCount,
  onClose,
}: {
  open: boolean;
  totalCount: number;
  onClose: () => void;
}) {
  const router = useRouter();
  const [confirmText, setConfirmText] = useState("");
  const [acknowledge, setAcknowledge] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Record<string, Record<string, number>> | null>(null);

  const canSubmit = confirmText.toUpperCase() === "RESET ALL" && acknowledge;

  function handleClose() {
    setConfirmText("");
    setAcknowledge(false);
    setError(null);
    setResult(null);
    onClose();
  }

  function handleSubmit() {
    if (!canSubmit) return;
    setError(null);
    const formData = new FormData();
    formData.append("confirmText", confirmText);
    formData.append("acknowledgeGlobal", String(acknowledge));
    startTransition(async () => {
      const res = await resetAllAction(formData);
      if ("error" in res) {
        setError(res.error);
        return;
      }
      setResult(res.counts);
      router.refresh();
    });
  }

  return (
    <Dialog modal={false} open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent
        title={result ? "Everything reset" : `Reset all ${totalCount} records?`}
        description={
          result
            ? "Done. This can't be undone."
            : "This permanently deletes every module's data — Employees, Suppliers, Clients, Projects, Timesheets, Accommodation, everything below. There is no undo."
        }
      >
        {result ? (
          <div className="mt-4 max-h-80 space-y-4 overflow-y-auto">
            {Object.entries(result).map(([moduleLabel, counts]) => (
              <div key={moduleLabel}>
                <p className="text-xs font-semibold text-primary">{moduleLabel}</p>
                <ul className="mt-1 space-y-0.5 text-sm text-secondary">
                  {Object.entries(counts).map(([table, n]) => (
                    <li key={table} className="flex justify-between">
                      <span className="capitalize">{table.replace(/([A-Z])/g, " $1").trim()}</span>
                      <span className="tabular font-medium text-primary">{n}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
            <DialogFooter>
              <button type="button" onClick={handleClose} className="btn btn-primary">
                Close
              </button>
            </DialogFooter>
          </div>
        ) : (
          <div className="mt-4 space-y-4">
            <label className="flex items-start gap-2 rounded-lg border border-[var(--error-border)] bg-[var(--error-soft)] p-3 text-sm text-[var(--error)]">
              <input
                type="checkbox"
                checked={acknowledge}
                onChange={(e) => setAcknowledge(e.target.checked)}
                className="mt-0.5"
              />
              <span>
                I understand this deletes every module&apos;s data, including data that isn&apos;t split by branch
                and every branch&apos;s data if none is selected.
              </span>
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-muted">
                Type <span className="font-semibold text-primary">RESET ALL</span> to confirm
              </span>
              <input
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                placeholder="RESET ALL"
                className="input w-full"
                autoFocus
              />
            </label>
            {error && <p className="text-sm text-[var(--error)]">{error}</p>}
            <DialogFooter>
              <button type="button" onClick={handleClose} className="btn btn-secondary">
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={!canSubmit || pending}
                className="btn btn-danger"
              >
                {pending ? "Deleting everything…" : "Delete everything"}
              </button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
