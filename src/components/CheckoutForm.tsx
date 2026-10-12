"use client";

import { useState, useTransition } from "react";
import { cancelScheduledCheckoutAction, checkOutWorkerAction } from "@/app/(app)/accommodation/actions";
import { DatePicker } from "@/components/ui/DatePicker";
import { Select } from "@/components/ui/Select";
import { CHECKOUT_REASONS, checkoutKind, checkoutProblem, daysBetween, todayKey } from "@/lib/checkoutReasons";

const fmt = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });

/** The checkout form: why, and on what date. A later date schedules the checkout instead of doing it now. */
export function CheckoutForm({ employeeId, name, bedLabel, checkInDate, planned, onDone, onCancel }: {
  employeeId: string;
  name: string;
  bedLabel: string;
  /** YYYY-MM-DD the current stay began. */
  checkInDate: string;
  /** A checkout already scheduled for this worker. */
  planned?: { date: string; reason: string } | null;
  onDone: () => void;
  onCancel: () => void;
}) {
  const today = todayKey();
  const [date, setDate] = useState(today);
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const kind = checkoutKind(date, today);
  const problem = checkoutProblem({ date, reason, note, checkInDate }, today);
  const daysBack = daysBetween(date, today);

  function submit() {
    setError(null);
    const fd = new FormData();
    fd.set("employeeId", employeeId);
    fd.set("date", date);
    fd.set("reason", reason);
    fd.set("note", note);
    start(async () => {
      const res = await checkOutWorkerAction(fd);
      if (res.error) setError(res.error);
      else onDone();
    });
  }

  return (
    <div className="mt-4 space-y-4">
      {planned && (
        <div className="rounded-lg border border-[var(--warning-border)] bg-[var(--warning-soft)] p-3 text-sm text-secondary">
          Already leaving on <span className="font-medium text-primary">{fmt(planned.date)}</span> ({planned.reason}).
          <button type="button" className="ml-2 font-medium text-[var(--brand-primary)] hover:underline" disabled={pending} onClick={() => start(async () => { const r = await cancelScheduledCheckoutAction(employeeId); if (r.error) setError(r.error); else onDone(); })}>Cancel the scheduled checkout</button>
        </div>
      )}
      <p className="text-sm text-secondary">Check <span className="font-medium text-primary">{name}</span> out of {bedLabel}.</p>
      <label className="block">
        <span className="mb-1 block text-xs font-medium text-muted">Reason *</span>
        <Select value={reason} onChange={setReason} placeholder="Choose a reason…" searchable={false} options={CHECKOUT_REASONS.map((r) => ({ value: r, label: r }))} />
      </label>
      {reason === "Other" && (
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-muted">Note *</span>
          <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} placeholder="What happened?" className="input w-full" />
        </label>
      )}
      <label className="block">
        <span className="mb-1 block text-xs font-medium text-muted">Checkout date *</span>
        <DatePicker value={date} onChange={setDate} min={checkInDate} className="w-full" />
        <span className="mt-1 block text-xs text-muted">Checked in on {fmt(checkInDate)}. You can back-date, or pick a later day to schedule it.</span>
      </label>
      {kind === "future" && (
        <p className="rounded-lg bg-brand-soft px-3 py-2 text-sm text-secondary">
          This is a <span className="font-medium text-primary">scheduled checkout</span>. {name} keeps the bed until {fmt(date)}, then it is freed automatically. You can cancel it before then.
        </p>
      )}
      {kind === "past" && daysBack > 30 && (
        <p className="rounded-lg border border-[var(--warning-border)] bg-[var(--warning-soft)] px-3 py-2 text-sm text-secondary">That&rsquo;s {daysBack} days ago. Check the date is right.</p>
      )}
      {error && <p role="alert" className="text-sm text-[var(--error)]">{error}</p>}
      <div className="flex justify-end gap-2">
        <button type="button" className="btn btn-secondary" onClick={onCancel} disabled={pending}>Cancel</button>
        <button type="button" className="btn btn-danger" onClick={submit} disabled={pending || !!problem}>
          {pending ? "Saving…" : kind === "future" ? "Schedule checkout" : "Check out"}
        </button>
      </div>
    </div>
  );
}
