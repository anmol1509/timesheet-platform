"use client";

import { useTransition } from "react";
import { updateQuotationStatusAction } from "../actions";

const TRANSITIONS: Record<string, { to: string; label: string; tone: "primary" | "secondary" }[]> = {
  // Sending a draft is done from the Send dialog; losing a deal from the Lost button (it asks why).
  SENT: [
    { to: "NEGOTIATION", label: "They want to negotiate", tone: "secondary" },
    { to: "APPROVED", label: "Client approved", tone: "primary" },
  ],
  NEGOTIATION: [{ to: "APPROVED", label: "Client approved", tone: "primary" }],
  APPROVED: [{ to: "ACCEPTED", label: "Client accepted", tone: "primary" }],
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
            opt.tone === "secondary"
              ? "border border-strong text-secondary hover:bg-surface-hover"
              : "bg-[var(--brand-primary)] text-white hover:bg-[var(--brand-primary-hover)]"
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
