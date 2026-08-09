"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Badge, type BadgeColor } from "@/components/Badge";
import { SegmentedControl } from "@/components/ui/RadioGroup";
import { MarkPaidButton } from "./mark-paid-button";
import { markInvoicePaidAction } from "./actions";

export type InvoiceRow = {
  id: string;
  invoiceNumber: string;
  clientName: string;
  monthLabel: string;
  totalAmount: number;
  status: string;
  dueDate: string | null;
  generatedByName: string;
};

function fmt(n: number) {
  return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function statusInfo(status: string, dueDate: string | null): { label: string; color: BadgeColor } {
  if (status === "PAID") return { label: "Paid", color: "green" };
  if (status === "SENT" && dueDate && new Date(dueDate).getTime() < Date.now()) {
    return { label: "Overdue", color: "red" };
  }
  if (status === "SENT") return { label: "Sent", color: "blue" };
  return { label: "Draft", color: "slate" };
}

export function InvoiceHistoryList({ invoices }: { invoices: InvoiceRow[] }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialStatus = searchParams.get("status");
  const [status, setStatus] = useState<"all" | "outstanding">(
    initialStatus === "outstanding" ? "outstanding" : "all"
  );

  const filtered =
    status === "outstanding" ? invoices.filter((i) => i.status !== "PAID") : invoices;

  return (
    <div className="space-y-4">
      <SegmentedControl
        value={status}
        onChange={(v) => {
          const next = v as "all" | "outstanding";
          setStatus(next);
          router.replace(next === "all" ? "/invoices/history" : "/invoices/history?status=outstanding");
        }}
        options={[
          { value: "all", label: `All (${invoices.length})` },
          {
            value: "outstanding",
            label: `Outstanding (${invoices.filter((i) => i.status !== "PAID").length})`,
          },
        ]}
      />

      {filtered.length === 0 ? (
        <p className="rounded-3xl border border-dashed border-slate-300 bg-white px-6 py-14 text-center text-sm text-slate-500">
          No invoices match this filter.
        </p>
      ) : (
        <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Invoice #</th>
                <th className="px-4 py-3">Client</th>
                <th className="px-4 py-3">Month</th>
                <th className="px-4 py-3 text-right">Total (AED)</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Due</th>
                <th className="px-4 py-3">Issued by</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((inv) => {
                const s = statusInfo(inv.status, inv.dueDate);
                return (
                  <tr key={inv.id}>
                    <td className="px-4 py-3 font-medium text-slate-900">{inv.invoiceNumber}</td>
                    <td className="px-4 py-3 text-slate-600">{inv.clientName}</td>
                    <td className="px-4 py-3 text-slate-600">{inv.monthLabel}</td>
                    <td className="px-4 py-3 text-right text-slate-900">{fmt(inv.totalAmount)}</td>
                    <td className="px-4 py-3">
                      <Badge color={s.color}>{s.label}</Badge>
                    </td>
                    <td className="px-4 py-3 text-slate-500">
                      {inv.dueDate ? new Date(inv.dueDate).toLocaleDateString("en-GB") : "—"}
                    </td>
                    <td className="px-4 py-3 text-slate-600">{inv.generatedByName}</td>
                    <td className="px-4 py-3 text-right">
                      {inv.status !== "PAID" && (
                        <MarkPaidButton
                          action={markInvoicePaidAction}
                          invoiceId={inv.id}
                          invoiceNumber={inv.invoiceNumber}
                        />
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
