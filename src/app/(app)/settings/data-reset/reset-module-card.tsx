"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { Dialog, DialogContent, DialogFooter } from "@/components/ui/Dialog";
import { Badge } from "@/components/Badge";
import { Button } from "@/components/ui/Button";
import { resetModuleAction } from "./actions";

export function ResetModuleCard({
  id,
  label,
  description,
  branchScoped,
  dependsOnLabels,
  count,
  disabled,
}: {
  id: string;
  label: string;
  description: string;
  branchScoped: boolean;
  dependsOnLabels: string[];
  count: number;
  disabled: boolean;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="card flex flex-col gap-3 p-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-primary">{label}</h3>
            <Badge color={branchScoped ? "slate" : "amber"}>{branchScoped ? "This branch" : "Global"}</Badge>
          </div>
          <p className="mt-1 text-xs text-muted">{description}</p>
          {dependsOnLabels.length > 0 && (
            <p className="mt-1 text-[11px] text-subtle">Reset first, if applicable: {dependsOnLabels.join(", ")}</p>
          )}
        </div>
        <span className="tabular shrink-0 rounded-md bg-surface-sunken px-2 py-1 text-sm font-semibold text-secondary">
          {count}
        </span>
      </div>

      <Button
        variant="danger"
        size="sm"
        onClick={() => setOpen(true)}
        disabled={disabled || count === 0}
        className="self-start"
      >
        <Trash2 className="h-3.5 w-3.5" />
        Reset
      </Button>

      <ResetDialog
        open={open}
        id={id}
        label={label}
        branchScoped={branchScoped}
        count={count}
        onClose={() => setOpen(false)}
      />
    </div>
  );
}

function ResetDialog({
  open,
  id,
  label,
  branchScoped,
  count,
  onClose,
}: {
  open: boolean;
  id: string;
  label: string;
  branchScoped: boolean;
  count: number;
  onClose: () => void;
}) {
  const router = useRouter();
  const [confirmText, setConfirmText] = useState("");
  const [acknowledgeGlobal, setAcknowledgeGlobal] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Record<string, number> | null>(null);

  const canSubmit = confirmText.toUpperCase() === label.toUpperCase() && (branchScoped || acknowledgeGlobal);

  function handleClose() {
    setConfirmText("");
    setAcknowledgeGlobal(false);
    setError(null);
    setResult(null);
    onClose();
  }

  function handleSubmit() {
    if (!canSubmit) return;
    setError(null);
    const formData = new FormData();
    formData.append("moduleId", id);
    formData.append("confirmText", confirmText);
    formData.append("acknowledgeGlobal", String(acknowledgeGlobal));
    startTransition(async () => {
      const res = await resetModuleAction(formData);
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
        title={result ? `${label} reset` : `Reset ${label}?`}
        description={
          result
            ? "Done. This can't be undone."
            : `This permanently deletes ${count} record${count === 1 ? "" : "s"} and everything tied to ${
                count === 1 ? "it" : "them"
              }. There is no undo.`
        }
      >
        {result ? (
          <div className="mt-4 space-y-3">
            <ul className="space-y-1 text-sm text-secondary">
              {Object.entries(result).map(([table, n]) => (
                <li key={table} className="flex justify-between">
                  <span className="capitalize">{table.replace(/([A-Z])/g, " $1").trim()}</span>
                  <span className="tabular font-medium text-primary">{n}</span>
                </li>
              ))}
            </ul>
            <DialogFooter>
              <button type="button" onClick={handleClose} className="btn btn-primary">
                Close
              </button>
            </DialogFooter>
          </div>
        ) : (
          <div className="mt-4 space-y-4">
            {!branchScoped && (
              <label className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                <input
                  type="checkbox"
                  checked={acknowledgeGlobal}
                  onChange={(e) => setAcknowledgeGlobal(e.target.checked)}
                  className="mt-0.5"
                />
                <span>This data isn&apos;t split by branch — resetting it affects every branch, not just the one you&apos;re viewing.</span>
              </label>
            )}
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-muted">
                Type <span className="font-semibold text-primary">{label}</span> to confirm
              </span>
              <input
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                placeholder={label}
                className="input w-full"
                autoFocus
              />
            </label>
            {error && <p className="text-sm text-red-600">{error}</p>}
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
                {pending ? "Deleting…" : `Delete all ${label}`}
              </button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
