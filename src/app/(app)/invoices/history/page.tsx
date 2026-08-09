import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireUserWithBranch } from "@/lib/auth";
import { branchWhere } from "@/lib/branch";
import { InvoiceHistoryList } from "./invoice-history-list";

function fmt(n: number) {
  return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
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

  const rows = invoices.map((inv) => ({
    id: inv.id,
    invoiceNumber: inv.invoiceNumber,
    clientName: inv.client.name,
    monthLabel: inv.monthLabel,
    totalAmount: inv.totalAmount,
    status: inv.status,
    dueDate: inv.dueDate ? inv.dueDate.toISOString() : null,
    generatedByName: inv.generatedBy.name,
  }));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Invoice history</h1>
          <p className="mt-1 text-sm text-slate-500">
            Every client invoice issued, most recent first.
          </p>
        </div>
        <Link
          href="/invoices/history?status=outstanding"
          className="block rounded-3xl border border-slate-200 bg-white px-5 py-3 transition hover:border-slate-300 hover:shadow-md"
        >
          <p className="text-xs font-medium text-slate-500">Outstanding (AED)</p>
          <p className="text-lg font-semibold text-slate-900">{fmt(outstanding)}</p>
        </Link>
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
        <InvoiceHistoryList invoices={rows} />
      )}
    </div>
  );
}
