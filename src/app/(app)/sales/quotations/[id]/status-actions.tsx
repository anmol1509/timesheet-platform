"use client";

import { useTransition } from "react";
import { updateQuotationStatusAction } from "../actions";

const TRANSITIONS: Record<string, { to: string; label: string; tone: "primary" | "danger" }[]> = {
  DRAFT: [{ to: "SENT", label: "Mark as Sent", tone: "primary" }],
  SENT: [
    { to: "NEGOTIATION", label: "Move to Negotiation", tone: "primary" },
    { to: "APPROVED", label: "Approve", tone: "primary" },
    { to: "REJECTED", label: "Reject", tone: "danger" },
  ],
  NEGOTIATION: [
    { to: "APPROVED", label: "Approve", tone: "primary" },
    { to: "REJECTED", label: "Reject", tone: "danger" },
  ],
  APPROVED: [
    { to: "ACCEPTED", label: "Client Accepted", tone: "primary" },
    { to: "REJECTED", label: "Reject", tone: "danger" },
  ],
};

export function QuotationStatusActions({ quotationId, status }: { quotationId: string; status: string }) {
  const [pending, startTransition] = useTransition();
  const options = TRANSITIONS[status] || [];
  if (options.length === 0) return null;

  function transition(to: string) {
    const formData = new FormData();
    formData.append("quotationId", quotationId);
    formData.append("status", to);
    startTransition(() => updateQuotationStatusAction(formData));
  }

  return (
    <div className="flex flex-wrap gap-2">
      {options.map((opt) => (
        <button
          key={opt.to}
          type="button"
          disabled={pending}
          onClick={() => transition(opt.to)}
          className={`rounded-lg px-4 py-2 text-sm font-medium transition disabled:opacity-50 ${
            opt.tone === "danger"
              ? "border border-red-300 text-red-700 hover:bg-red-50"
              : "bg-[var(--brand-primary)] text-white hover:bg-[var(--brand-primary-hover)]"
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
