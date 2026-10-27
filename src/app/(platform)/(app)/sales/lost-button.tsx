"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Dialog, DialogContent, DialogFooter, DialogTrigger } from "@/components/ui/Dialog";
import { Select } from "@/components/ui/Select";
import { markLostAction } from "./activity-actions";

const REASONS = ["Price too high", "Went with another supplier", "Project cancelled or delayed", "No response", "Client hired directly", "Other"];

/** "Mark as lost" with the reason, so the pipeline can later show why deals are lost. */
export function LostButton({ entity, id, label = "Mark as lost" }: { entity: "quotation" | "enquiry"; id: string; label?: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [reason, setReason] = useState("");
  const [extra, setExtra] = useState("");
  const [error, setError] = useState<string | null>(null);

  function submit() {
    const full = [reason, extra.trim()].filter(Boolean).join(": ");
    start(async () => {
      const res = await markLostAction({ entity, id }, full);
      if (res.error) return setError(res.error);
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button type="button" className="rounded-lg border border-[var(--error-border)] px-4 py-2 text-sm font-medium text-[var(--error)] transition hover:bg-[var(--error-soft)]">{label}</button>
      </DialogTrigger>
      {open && (
        <DialogContent title="Why was it lost?" description="Only you and your team see this. It helps you see patterns later.">
          <div className="mt-4 space-y-3">
            <Select value={reason} onChange={setReason} searchable={false} placeholder="Choose a reason" options={REASONS.map((r) => ({ value: r, label: r }))} />
            <textarea value={extra} onChange={(e) => setExtra(e.target.value)} rows={2} placeholder="Anything to add (optional)" className="input w-full" />
            {error && <p role="alert" className="text-sm text-[var(--error)]">{error}</p>}
          </div>
          <DialogFooter>
            <button type="button" className="btn btn-secondary" onClick={() => setOpen(false)}>Cancel</button>
            <button type="button" className="btn btn-primary" disabled={pending || !reason} onClick={submit}>{pending ? "Saving…" : "Mark as lost"}</button>
          </DialogFooter>
        </DialogContent>
      )}
    </Dialog>
  );
}
