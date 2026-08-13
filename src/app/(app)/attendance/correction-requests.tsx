"use client";

import { useTransition } from "react";
import { reviewCorrectionRequestAction } from "./actions";

type Correction = {
  id: string;
  reason: string | null;
  requestedStatus: string | null;
  requestedNormalHours: number | null;
  requestedOtHours: number | null;
  employeeName: string;
  employeeIdNo: string;
  date: string;
};

export function CorrectionRequests({ corrections }: { corrections: Correction[] }) {
  const [pending, startTransition] = useTransition();

  function review(id: string, decision: "APPROVED" | "REJECTED") {
    const formData = new FormData();
    formData.append("correctionId", id);
    formData.append("decision", decision);
    startTransition(async () => {
      await reviewCorrectionRequestAction(formData);
    });
  }

  return (
    <div>
      <h2 className="mb-3 text-sm font-semibold text-slate-900">
        Pending correction requests ({corrections.length})
      </h2>
      <div className="space-y-3">
        {corrections.map((c) => (
          <div key={c.id} className="rounded-2xl border border-slate-200 bg-white p-4">
            <p className="text-sm font-medium text-slate-900">
              {c.employeeName} <span className="text-slate-400">{c.employeeIdNo}</span> —{" "}
              {c.date}
            </p>
            <p className="mt-1 text-xs text-slate-600">
              Requested:{" "}
              {[
                c.requestedStatus,
                c.requestedNormalHours != null ? `${c.requestedNormalHours} normal hrs` : null,
                c.requestedOtHours != null ? `${c.requestedOtHours} OT hrs` : null,
              ]
                .filter(Boolean)
                .join(", ") || "no field changes"}
            </p>
            {c.reason && <p className="mt-1 text-xs text-slate-500">Reason: {c.reason}</p>}
            <div className="mt-2 flex gap-2">
              <button
                type="button"
                disabled={pending}
                onClick={() => review(c.id, "APPROVED")}
                className="rounded-lg border border-emerald-300 px-3 py-1.5 text-xs font-medium text-emerald-700 hover:bg-emerald-50 disabled:opacity-50"
              >
                Approve
              </button>
              <button
                type="button"
                disabled={pending}
                onClick={() => review(c.id, "REJECTED")}
                className="rounded-lg border border-red-300 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
              >
                Reject
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
