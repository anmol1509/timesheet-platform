"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Badge, type BadgeColor } from "@/components/Badge";
import { SegmentedControl } from "@/components/ui/RadioGroup";
import { MarkPaidButton } from "./mark-paid-button";
import { DeleteButton } from "@/components/DeleteButton";
import { deleteInvoiceAction } from "./actions";
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
        <p className="empty-state text-sm text-muted">
          No invoices match this filter.
        </p>
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="border-b border-default bg-surface-subtle text-left text-xs font-medium uppercase tracking-wide text-muted">
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
            <tbody className="divide-y divide-[var(--border)]">
              {filtered.map((inv) => {
                const s = statusInfo(inv.status, inv.dueDate);
                return (
                  <tr key={inv.id}>
                    <td className="px-4 py-3 font-medium text-primary">{inv.invoiceNumber}</td>
                    <td className="px-4 py-3 text-secondary">{inv.clientName}</td>
                    <td className="px-4 py-3 text-secondary">{inv.monthLabel}</td>
                    <td className="px-4 py-3 text-right text-primary">{fmt(inv.totalAmount)}</td>
                    <td className="px-4 py-3">
                      <Badge color={s.color}>{s.label}</Badge>
                    </td>
                    <td className="px-4 py-3 text-muted">
                      {inv.dueDate ? new Date(inv.dueDate).toLocaleDateString("en-GB") : "—"}
                    </td>
                    <td className="px-4 py-3 text-secondary">{inv.generatedByName}</td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      {inv.status !== "PAID" && (
                        <span className="mr-3 inline-block">
                          <MarkPaidButton
                            action={markInvoicePaidAction}
                            invoiceId={inv.id}
                            invoiceNumber={inv.invoiceNumber}
                          />
                        </span>
                      )}
                      {/* Only drafts can go — anything sent is an external record. */}
                      {inv.status === "DRAFT" && (
                        <DeleteButton
                          action={deleteInvoiceAction}
                          hiddenFields={{ invoiceId: inv.id }}
                          confirmMessage={`Delete draft invoice ${inv.invoiceNumber} for ${inv.clientName}?`}
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
