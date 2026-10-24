"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Button";
import { createOwnCompanyAction } from "./actions";

export function AddCompanyDialog() {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  return (
    <>
      <Button size="sm" onClick={() => { setError(null); setOpen(true); }}>
        <Plus className="h-3.5 w-3.5" aria-hidden />
        Add company
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent title="Add a company" description="One of the companies you own. You can add its documents, owners and sponsors, logo and bank details next.">
          <form
            className="mt-4 space-y-3"
            action={async (fd) => {
              setError(null);
              setPending(true);
              const r = await createOwnCompanyAction(fd);
              setPending(false);
              if (r?.error) setError(r.error);
            }}
          >
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-muted">Company name</span>
              <input name="name" required autoFocus className="input w-full" placeholder="e.g. Gulf Skills Manpower" />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-muted">Full legal name (optional)</span>
              <input name="fullName" className="input w-full" placeholder="As on the trade licence" />
            </label>
            {error && <p role="alert" className="text-sm text-[var(--error)]">{error}</p>}
            <div className="flex justify-end gap-2 pt-1">
              <button type="button" className="btn btn-secondary" onClick={() => setOpen(false)}>Cancel</button>
              <button type="submit" className="btn btn-primary" disabled={pending}>{pending ? "Adding…" : "Add company"}</button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
