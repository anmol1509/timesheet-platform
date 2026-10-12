"use client";

import { useState, useTransition } from "react";
import { addCorrectionAction } from "../actions";

/** For an approved or paid run: add a one-off amount to next month's pay instead of reopening this month. */
export function CorrectionCell({ lineId, nextMonth }: { lineId: string; nextMonth: string }) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  if (done) return <span className="text-xs text-[var(--success)]">Added to {nextMonth}</span>;
  if (!open) return <button type="button" className="text-xs font-medium text-[var(--brand-primary)] hover:underline" onClick={() => setOpen(true)}>Correct in {nextMonth}</button>;
  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    fd.set("lineId", lineId);
    setError(null);
    start(async () => { const r = await addCorrectionAction(fd); if (r.error) setError(r.error); else setDone(true); });
  }
  return (
    <form onSubmit={submit} className="flex min-w-48 flex-col gap-1">
      <select name="kind" className="input h-8 text-xs" aria-label="Type"><option value="EARNING">Pay extra</option><option value="DEDUCTION">Take off</option></select>
      <input name="amount" type="number" step="0.01" min="0" placeholder="Amount (AED)" className="input h-8 text-xs" aria-label="Amount" required />
      <input name="label" placeholder="What for?" className="input h-8 text-xs" aria-label="Reason" required />
      <div className="flex gap-2"><button type="submit" disabled={pending} className="btn btn-primary h-7 px-3 text-xs">{pending ? "Adding…" : `Add to ${nextMonth}`}</button><button type="button" className="text-xs text-muted" onClick={() => setOpen(false)}>Cancel</button></div>
      {error && <p role="alert" className="text-xs text-[var(--error)]">{error}</p>}
    </form>
  );
}
