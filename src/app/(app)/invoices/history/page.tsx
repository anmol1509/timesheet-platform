import Link from "next/link";
import { prisma } from "@/lib/db";
import { Badge, type BadgeColor } from "@/components/Badge";
import { requireUserWithBranch } from "@/lib/auth";
import { branchWhere } from "@/lib/branch";
import { markInvoicePaidAction } from "./actions";
import { MarkPaidButton } from "./mark-paid-button";

function fmt(n: number) {
  return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function statusInfo(status: string, dueDate: Date | null): { label: string; color: BadgeColor } {
  if (status === "PAID") return { label: "Paid", color: "green" };
  if (status === "SENT" && dueDate && dueDate.getTime() < Date.now()) {
    return { label: "Overdue", color: "red" };
  }
  if (status === "SENT") return { label: "Sent", color: "blue" };
  return { label: "Draft", color: "slate" };
}

export default async function InvoiceHistoryPage() {
  const { branchId } = await requireUserWithBranch();
  const invoices = await prisma.clientInvoice.findMany({
    where: branchWhere(branchId),
    orderBy: { issueDate: "desc" },
    take: 200,
    include: { client: true, generatedBy: true },
  });

  const outstanding = invoices
    .filter((i) => i.status !== "PAID")
    .reduce((s, i) => s + i.totalAmount, 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Invoice history</h1>
          <p className="mt-1 text-sm text-slate-500">
            Every client invoice issued, most recent first.
          </p>
        </div>
        <div className="rounded-3xl border border-slate-200 bg-white px-5 py-3">
          <p className="text-xs font-medium text-slate-500">Outstanding (AED)</p>
          <p className="text-lg font-semibold text-slate-900">{fmt(outstanding)}</p>
        </div>
      </div>

      {invoices.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-slate-300 bg-white px-6 py-14 text-center">
          <p className="text-sm text-slate-500">
            Nothing issued yet.{" "}
            <Link href="/invoices" className="font-medium text-slate-900 underline">
              Go to Invoices
            </Link>{" "}
            to generate one.
          </p>
        </div>
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
              {invoices.map((inv) => {
                const s = statusInfo(inv.status, inv.dueDate);
                return (
                  <tr key={inv.id}>
                    <td className="px-4 py-3 font-medium text-slate-900">
                      {inv.invoiceNumber}
                    </td>
                    <td className="px-4 py-3 text-slate-600">{inv.client.name}</td>
                    <td className="px-4 py-3 text-slate-600">{inv.monthLabel}</td>
                    <td className="px-4 py-3 text-right text-slate-900">
                      {fmt(inv.totalAmount)}
                    </td>
                    <td className="px-4 py-3">
                      <Badge color={s.color}>{s.label}</Badge>
                    </td>
                    <td className="px-4 py-3 text-slate-500">
                      {inv.dueDate
                        ? new Date(inv.dueDate).toLocaleDateString("en-GB")
                        : "—"}
                    </td>
                    <td className="px-4 py-3 text-slate-600">{inv.generatedBy.name}</td>
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
