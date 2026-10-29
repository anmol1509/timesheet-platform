"use client";

import { useState, useTransition } from "react";
import * as Popover from "@radix-ui/react-popover";
import { MoreHorizontal } from "lucide-react";
import { addCorrectionAction, refreshLineBankAction, setLinePaymentAction } from "../actions";
import { Badge, type BadgeColor } from "@/components/Badge";

import { Button } from "@/components/ui/Button";
const STATUS: Record<string, { label: string; color: BadgeColor }> = {
  PENDING: { label: "Awaiting bank", color: "slate" },
  PAID: { label: "Paid", color: "green" },
  REJECTED: { label: "Rejected", color: "red" },
  RESUBMIT: { label: "Fixed: resend", color: "amber" },
};

/**
 * What the bank did with one worker's salary: the status shows, and everything you can do about it sits behind one
 * "⋯" (mark paid, bank rejected, use updated details, correct next month) instead of three links on every row.
 */
export function PaymentCell({ lineId, status, note, editable, canCorrect, nextMonth }: { lineId: string; status: string; note: string; editable: boolean; canCorrect: boolean; nextMonth: string }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"menu" | "reject" | "correct">("menu");
  const [reason, setReason] = useState(note);
  const [done, setDone] = useState<string | null>(null);

  const call = (fn: (fd: FormData) => Promise<{ error: string | null }>, fields: Record<string, string>, after?: () => void) =>
    start(async () => {
      setError(null);
      const fd = new FormData();
      fd.set("lineId", lineId);
      for (const [k, v] of Object.entries(fields)) fd.set(k, v);
      const res = await fn(fd);
      if (res.error) setError(res.error);
      else { setMode("menu"); setOpen(false); after?.(); }
    });

  function submitCorrection(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    fd.set("lineId", lineId);
    setError(null);
    start(async () => {
      const r = await addCorrectionAction(fd);
      if (r.error) setError(r.error);
      else { setDone(`Added to ${nextMonth}`); setMode("menu"); setOpen(false); }
    });
  }

  const meta = STATUS[status] ?? STATUS.PENDING;
  const item = "block w-full rounded-sm px-2.5 py-1.5 text-left text-sm text-secondary hover:bg-surface-hover hover:text-primary disabled:opacity-50";
  const hasMenu = editable || canCorrect;
  return (
    <div className="flex min-w-36 flex-col gap-1">
      <div className="flex items-center gap-1.5">
        <Badge color={meta.color} dot>{meta.label}</Badge>
        {hasMenu && (
          <Popover.Root open={open} onOpenChange={(o) => { setOpen(o); if (!o) { setMode("menu"); setError(null); } }}>
            <Popover.Trigger asChild>
              <button type="button" aria-label="Payment actions" className="rounded-md p-1 text-subtle hover:bg-surface-sunken hover:text-primary"><MoreHorizontal className="h-4 w-4" aria-hidden /></button>
            </Popover.Trigger>
            <Popover.Portal>
              <Popover.Content align="end" sideOffset={4} className="rx-popover z-50 w-64 rounded-control border border-default bg-surface p-1 shadow-popover">
                {mode === "menu" && (
                  <>
                    {editable && status !== "PAID" && <button type="button" disabled={pending} className={item} onClick={() => call(setLinePaymentAction, { status: "PAID" })}>Mark paid</button>}
                    {editable && status !== "REJECTED" && status !== "RESUBMIT" && <button type="button" disabled={pending} className={`${item} text-[var(--error)] hover:text-[var(--error)]`} onClick={() => setMode("reject")}>Bank rejected…</button>}
                    {editable && status === "REJECTED" && <button type="button" disabled={pending} className={item} onClick={() => call(refreshLineBankAction, {})}>Use updated bank details</button>}
                    {canCorrect && <button type="button" className={item} onClick={() => setMode("correct")}>Correct in {nextMonth}…</button>}
                  </>
                )}
                {mode === "reject" && (
                  <div className="space-y-2 p-2">
                    <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason from the bank" aria-label="Rejection reason" className="input w-full text-sm" autoFocus />
                    <div className="flex gap-2"><button type="button" disabled={pending} className="btn btn-primary btn-sm" onClick={() => call(setLinePaymentAction, { status: "REJECTED", note: reason })}>Save</button><button type="button" className="btn btn-secondary btn-sm" onClick={() => setMode("menu")}>Back</button></div>
                  </div>
                )}
                {mode === "correct" && (
                  <form onSubmit={submitCorrection} className="space-y-2 p-2">
                    <select name="kind" className="input h-9 w-full text-sm" aria-label="Type"><option value="EARNING">Pay extra</option><option value="DEDUCTION">Take off</option></select>
                    <input name="amount" type="number" step="0.01" min="0" placeholder="Amount (AED)" className="input h-9 w-full text-sm" aria-label="Amount" required />
                    <input name="label" placeholder="What for?" className="input h-9 w-full text-sm" aria-label="Reason" required />
                    <div className="flex gap-2"><Button size="btn-sm" type="submit" disabled={pending} loading={pending}>{`Add to ${nextMonth}`}</Button><button type="button" className="btn btn-secondary btn-sm" onClick={() => setMode("menu")}>Back</button></div>
                  </form>
                )}
                {error && <p role="alert" className="px-2.5 py-1.5 text-xs text-[var(--error)]">{error}</p>}
              </Popover.Content>
            </Popover.Portal>
          </Popover.Root>
        )}
      </div>
      {note && status !== "PAID" && <span className="max-w-48 text-xs text-muted">{note}</span>}
      {done && <span className="text-xs text-[var(--success)]">{done}</span>}
    </div>
  );
}
