import { History } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
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

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const open = invoices.filter((i) => i.status !== "PAID");
  const overdue = open.filter((i) => i.dueDate && i.dueDate < now);
  const paidThisMonth = invoices.filter((i) => i.status === "PAID" && i.paidDate && i.paidDate >= monthStart);
  const billedThisMonth = invoices.filter((i) => i.issueDate >= monthStart);
  const total = (xs: { totalAmount: number }[]) => xs.reduce((n, i) => n + i.totalAmount, 0);
  const strip = [
    { l: "Billed this month", v: fmt(total(billedThisMonth)), sub: `${billedThisMonth.length} invoice${billedThisMonth.length === 1 ? "" : "s"}` },
    { l: "Outstanding", v: fmt(outstanding), sub: `${open.length} unpaid`, href: "/invoices/history?status=outstanding" },
    { l: "Overdue", v: fmt(total(overdue)), sub: `${overdue.length} invoice${overdue.length === 1 ? "" : "s"}`, tone: overdue.length ? "text-[var(--error)]" : "" },
    { l: "Collected this month", v: fmt(total(paidThisMonth)), sub: `${paidThisMonth.length} paid`, tone: "text-[var(--success)]" },
  ];

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
        <p className="rounded-lg border border-[var(--error-border)] bg-[var(--error-soft)] px-4 py-2 text-sm text-[var(--error)]">
          {error}
        </p>
      )}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <PageHeader
          title="Invoice history"
          icon={History}
          description={<>Every client invoice issued, most recent first.</>}
        />
      </div>

      <div className="grid grid-cols-2 gap-2 lg:grid-cols-4 lg:gap-3">
        {strip.map((t) => {
          const body = (
            <>
              <p className="text-[11px] font-medium text-muted sm:text-xs">{t.l} (AED)</p>
              <p className={`tabular mt-0.5 truncate text-base font-semibold tracking-tight sm:text-xl ${t.tone || "text-primary"}`}>{t.v}</p>
              <p className="text-xs text-subtle">{t.sub}</p>
            </>
          );
          return t.href ? <Link key={t.l} href={t.href} className="card block px-3 py-2.5 transition hover:border-strong sm:px-4 sm:py-3">{body}</Link> : <div key={t.l} className="card px-3 py-2.5 sm:px-4 sm:py-3">{body}</div>;
        })}
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
