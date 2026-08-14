"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogFooter } from "./Dialog";

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
  onConfirm: () => void | Promise<void>;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      {trigger(() => setOpen(true))}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent title={title} description={description}>
          <DialogFooter>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="btn btn-secondary px-3"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={async () => {
                setOpen(false);
                await onConfirm();
              }}
              className={
                danger
                  ? "rounded-lg bg-red-600 px-3 py-2 text-sm font-medium text-white transition hover:bg-red-700"
                  : "btn btn-primary px-3"
              }
            >
              {confirmLabel}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
