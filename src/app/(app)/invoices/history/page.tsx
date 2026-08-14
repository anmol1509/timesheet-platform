import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireUserWithBranch } from "@/lib/auth";
import { branchWhere } from "@/lib/branch";
import { InvoiceHistoryList } from "./invoice-history-list";

function fmt(n: number) {
  return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default async function InvoiceHistoryPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
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
    <div className="space-y-5">
      {error && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">
          {error}
        </p>
      )}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-xl tracking-tight text-primary font-semibold">Invoice history</h1>
          <p className="mt-1 text-sm text-muted">
            Every client invoice issued, most recent first.
          </p>
        </div>
        <Link
          href="/invoices/history?status=outstanding"
          className="card block px-5 py-3 transition hover:border-strong hover:shadow-md"
        >
          <p className="text-xs font-medium text-muted">Outstanding (AED)</p>
          <p className="text-lg font-semibold text-primary">{fmt(outstanding)}</p>
        </Link>
      </div>

      {invoices.length === 0 ? (
        <div className="empty-state">
          <p className="text-sm text-muted">
            Nothing issued yet.{" "}
            <Link href="/invoices" className="font-medium text-primary underline">
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
