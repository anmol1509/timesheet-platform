"use client";

import { useTransition } from "react";
import { Badge, type BadgeColor } from "@/components/Badge";
import { updateSupplierApprovalAction } from "../actions";

type ApprovalField = "approvalStatus" | "labourApprovalStatus" | "invoiceApprovalStatus";

const ROWS: { field: ApprovalField; label: string }[] = [
  { field: "approvalStatus", label: "Supplier Approval" },
  { field: "labourApprovalStatus", label: "Labour Approval" },
  { field: "invoiceApprovalStatus", label: "Invoice Approval" },
];

const BADGE_COLOR: Record<string, BadgeColor> = {
  Approved: "green",
  Pending: "amber",
  Rejected: "red",
};

export function SupplierApprovals({
  supplierId,
  values,
}: {
  supplierId: string;
  values: Record<ApprovalField, string>;
}) {
  const [pending, startTransition] = useTransition();

  function setValue(field: ApprovalField, value: string) {
    const formData = new FormData();
    formData.append("supplierId", supplierId);
    formData.append("field", field);
    formData.append("value", value);
    startTransition(() => {
      updateSupplierApprovalAction(formData);
    });
  }

  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-5">
      <h2 className="mb-3 text-sm font-semibold text-slate-900">Approvals</h2>
      <div className="space-y-2">
        {ROWS.map((r) => (
          <div key={r.field} className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-sm text-slate-700">{r.label}</span>
            <div className="flex items-center gap-2">
              <Badge color={BADGE_COLOR[values[r.field]] || "slate"}>{values[r.field]}</Badge>
              <button
                type="button"
                disabled={pending || values[r.field] === "Approved"}
                onClick={() => setValue(r.field, "Approved")}
                className="rounded-lg border border-slate-300 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Approve
              </button>
              <button
                type="button"
                disabled={pending || values[r.field] === "Rejected"}
                onClick={() => setValue(r.field, "Rejected")}
                className="rounded-lg border border-red-200 px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Reject
              </button>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
