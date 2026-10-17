import { Receipt, ReceiptText, Hourglass, FileCheck2, Wallet } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { monthLabelFromKey } from "@/lib/timesheetSummary";
import { requireUserWithBranch } from "@/lib/auth";
import { branchWhere } from "@/lib/branch";
import { InvoiceGrid } from "./invoice-grid";
import { MonthPicker } from "./invoice-filters";
import { StatTile } from "@/components/StatTile";
import { StatusDonut } from "@/components/Donut";
import { Insights } from "@/components/ListSummary";

export default async function InvoicesPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const params = await searchParams;
  const { branchId } = await requireUserWithBranch();

  const monthRows = await prisma.timesheetEntry.findMany({
    where: { clientId: { not: null }, ...branchWhere(branchId) },
    distinct: ["month"],
    select: { month: true },
    orderBy: { month: "desc" },
  });
  const months = monthRows.map((m) => m.month);
  const selectedMonth = params.month && months.includes(params.month)
    ? params.month
    : months[0];

  const [clients, invoicesByStatus, monthInvoices, unpaid] = await Promise.all([
    selectedMonth
      ? prisma.client.findMany({
          where: {
            entries: { some: { month: selectedMonth, status: "CLIENT_APPROVED" } },
            ...branchWhere(branchId),
          },
          include: {
            entries: { where: { month: selectedMonth, status: "CLIENT_APPROVED" } },
            tradeRates: true,
          },
          orderBy: { name: "asc" },
        })
      : Promise.resolve([]),
    prisma.clientInvoice.groupBy({ by: ["status"], where: branchWhere(branchId), _count: { _all: true } }),
    selectedMonth ? prisma.clientInvoice.findMany({ where: { ...branchWhere(branchId), month: selectedMonth }, select: { clientId: true, totalAmount: true } }) : Promise.resolve([]),
    prisma.clientInvoice.aggregate({ where: { ...branchWhere(branchId), status: { not: "PAID" } }, _sum: { totalAmount: true }, _count: { _all: true } }),
  ]);
  const invoicedClients = new Set(monthInvoices.map((i) => i.clientId));
  const rows = clients.map((c) => {
    const tradeRateMap = Object.fromEntries(c.tradeRates.map((r) => [r.trade, r.rate]));
    const fallbackRate = c.hourlyRate ?? c.basicRate ?? null;
    const totalHours = c.entries.reduce((sum, e) => sum + e.totalHours, 0);
    const cost = c.entries.reduce((sum, e) => sum + e.totalHours * e.rate, 0);
    let amount = 0;
    const unratedTrades = new Set<string>();
    for (const e of c.entries) {
      const rate = tradeRateMap[e.trade] ?? fallbackRate;
      if (rate == null) unratedTrades.add(e.trade);
      amount += e.totalHours * (rate ?? 0);
    }
    return { id: c.id, name: c.name, employeeCount: c.entries.length, totalHours, billRateSet: unratedTrades.size === 0, unratedTrades: [...unratedTrades], amount, margin: amount - cost, invoiced: invoicedClients.has(c.id) };
  });
  const ready = rows.filter((r) => r.billRateSet && !r.invoiced);
  const readyAmount = ready.reduce((n, r) => n + r.amount, 0);
  const blocked = rows.filter((r) => !r.billRateSet && !r.invoiced);
  const invoicedTotal = monthInvoices.reduce((n, i) => n + i.totalAmount, 0);
  const aed = (n: number) => `AED ${Math.round(n).toLocaleString("en-AE")}`;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Invoices"
        icon={Receipt}
        description={<>Pick a month, then review and generate a client invoice.</>}
        actions={
          <div className="flex flex-wrap items-center gap-3">
            {months.length > 0 && <MonthPicker value={selectedMonth ?? ""} months={months.map((m) => ({ value: m, label: monthLabelFromKey(m) }))} />}
            <Link href="/invoices/history" className="btn btn-secondary btn-sm">History</Link>
          </div>
        }
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatTile label="Ready to invoice" value={aed(readyAmount)} icon={ReceiptText} hint={`${ready.length} client${ready.length === 1 ? "" : "s"}`} />
        <StatTile label="Blocked: no rate" value={blocked.length} icon={Hourglass} tone={blocked.length > 0 ? "warning" : "default"} hint={blocked.length > 0 ? "set the client's rate to bill them" : "none"} />
        <StatTile label="Invoiced this month" value={aed(invoicedTotal)} icon={FileCheck2} hint={`${monthInvoices.length} invoice${monthInvoices.length === 1 ? "" : "s"}`} />
        <StatTile label="Unpaid, all time" value={aed(unpaid._sum.totalAmount ?? 0)} icon={Wallet} hint={`${unpaid._count._all} invoice${unpaid._count._all === 1 ? "" : "s"}`} />
      </div>

      {invoicesByStatus.length > 0 && (
        <Insights id="invoices" title="All-time invoices by status">
          <StatusDonut
            items={invoicesByStatus.map((r) => ({ status: r.status, count: r._count._all }))}
          />
        </Insights>
      )}

      {rows.length === 0 && (
        <div className="empty-state flex flex-col items-center gap-3 py-10">
          <p className="max-w-md text-center text-sm text-muted">
            Nothing billable for this month yet. Timesheet entries need a client and client approval before they show here.
          </p>
          <div className="flex gap-2">
            <Link href="/invoices/client-timesheet" className="btn btn-primary btn-sm">Open Client Timesheet</Link>
          </div>
        </div>
      )}

      {rows.length > 0 && <InvoiceGrid month={selectedMonth!} clients={rows} />}
    </div>
  );
}
