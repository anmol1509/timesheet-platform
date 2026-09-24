"use client";

import { useState, useTransition } from "react";
import { refreshLineBankAction, setLinePaymentAction } from "../actions";
import { Badge, type BadgeColor } from "@/components/Badge";

const STATUS: Record<string, { label: string; color: BadgeColor }> = {
  PENDING: { label: "Awaiting bank", color: "slate" },
  PAID: { label: "Paid", color: "green" },
  REJECTED: { label: "Rejected", color: "red" },
  RESUBMIT: { label: "Fixed — resend", color: "amber" },
};

/** What the bank did with one worker's salary. Editable once the run is approved. */
export function PaymentCell({ lineId, status, note, editable }: { lineId: string; status: string; note: string; editable: boolean }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState(note);

  const call = (fn: (fd: FormData) => Promise<{ error: string | null }>, fields: Record<string, string>) =>
    start(async () => {
      setError(null);
      const fd = new FormData();
      fd.set("lineId", lineId);
      for (const [k, v] of Object.entries(fields)) fd.set(k, v);
      const res = await fn(fd);
      if (res.error) setError(res.error);
      else setRejecting(false);
    });

  const meta = STATUS[status] ?? STATUS.PENDING;
  return (
    <div className="flex min-w-40 flex-col gap-1">
      <Badge color={meta.color} dot>{meta.label}</Badge>
      {note && status !== "PAID" && <span className="max-w-48 text-xs text-muted">{note}</span>}
      {editable && (
        <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs">
          {status !== "PAID" && <button type="button" disabled={pending} className="font-medium text-[var(--brand-primary)] hover:underline" onClick={() => call(setLinePaymentAction, { status: "PAID" })}>Mark paid</button>}
          {status !== "REJECTED" && status !== "RESUBMIT" && <button type="button" disabled={pending} className="font-medium text-[var(--error)] hover:underline" onClick={() => setRejecting(true)}>Bank rejected</button>}
          {status === "REJECTED" && <button type="button" disabled={pending} className="font-medium text-[var(--brand-primary)] hover:underline" onClick={() => call(refreshLineBankAction, {})}>Use updated bank details</button>}
        </div>
      )}
      {rejecting && (
        <div className="flex gap-1">
          <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason from the bank" aria-label="Rejection reason" className="input w-40 text-xs" />
          <button type="button" disabled={pending} className="btn btn-primary" onClick={() => call(setLinePaymentAction, { status: "REJECTED", note: reason })}>Save</button>
        </div>
      )}
      {error && <p role="alert" className="max-w-48 text-xs text-[var(--error)]">{error}</p>}
    </div>
  );
}
