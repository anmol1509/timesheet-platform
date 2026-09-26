import { Receipt } from "lucide-react";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { PageHeader } from "@/components/PageHeader";
import { DashboardTabs } from "@/components/DashboardTabs";
import { KpiStrip } from "@/components/KpiStrip";
import { Panel } from "@/components/DashboardPanel";
import { StatusBreakdown } from "@/components/StatusBreakdown";
import { BarList } from "@/components/BarList";
import { requireUserWithBranch } from "@/lib/auth";
import { branchWhere } from "@/lib/branch";

export default async function BillingDashboardPage() {
  const { branchId } = await requireUserWithBranch();
  const branchScope = branchWhere(branchId);

  const [statusBreakdown, outstanding, overdueInvoices, byClient, clients] = await Promise.all([
    prisma.clientInvoice.groupBy({
      by: ["status"],
      where: branchScope,
      _count: { _all: true },
      _sum: { totalAmount: true },
    }),
    prisma.clientInvoice.aggregate({
      where: { ...branchScope, status: { not: "PAID" } },
      _sum: { totalAmount: true },
    }),
    prisma.clientInvoice.findMany({
      where: { ...branchScope, status: "OVERDUE" },
      select: {
        id: true,
        invoiceNumber: true,
        totalAmount: true,
        dueDate: true,
        client: { select: { name: true } },
      },
      orderBy: { dueDate: "asc" },
      take: 10,
    }),
    prisma.clientInvoice.groupBy({
      by: ["clientId"],
      where: branchScope,
      _sum: { totalAmount: true },
      orderBy: { _sum: { totalAmount: "desc" } },
      take: 8,
    }),
    prisma.client.findMany({ where: branchScope, select: { id: true, name: true } }),
  ]);
  const clientName = new Map(clients.map((c) => [c.id, c.name]));

  const totalInvoices = statusBreakdown.reduce(
    (sum, s) => sum + s._count._all,
    0,
  );
  const paidCount =
    statusBreakdown.find((s) => s.status === "PAID")?._count._all ?? 0;
  const overdueCount =
    statusBreakdown.find((s) => s.status === "OVERDUE")?._count._all ?? 0;

  return (
    <div className="space-y-5">
      <PageHeader
        icon={Receipt}
        title="Billing overview"
        description="Invoice status and outstanding balances."
      />
      <DashboardTabs />

      <KpiStrip
        cells={[
          {
            label: "Total invoices",
            value: totalInvoices,
            sub: "issued",
            href: "/invoices",
          },
          {
            label: "Paid",
            value: paidCount,
            sub: "settled",
            href: "/invoices",
          },
          {
            label: "Overdue",
            value: overdueCount,
            sub: "past due date",
            href: "/invoices",
            tone:
              overdueCount > 0 ? ("warning" as const) : ("default" as const),
          },
          {
            label: "Outstanding",
            value: `AED ${(outstanding._sum.totalAmount ?? 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}`,
            sub: "unpaid balance",
            href: "/invoices",
          },
        ]}
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Panel title="Invoiced by client" href="/invoices/history" className="lg:col-span-2">
          <BarList
            items={byClient.map((r) => ({ key: r.clientId, label: clientName.get(r.clientId) ?? "Unknown client", value: Math.round(r._sum.totalAmount ?? 0), href: `/clients/${r.clientId}` }))}
            format={(n) => `AED ${n.toLocaleString("en-AE")}`}
            emptyLabel="No invoices yet."
          />
        </Panel>

        <Panel title="Invoices by status" href="/invoices">
          <StatusBreakdown
            items={statusBreakdown.map((r) => ({
              status: r.status,
              count: r._count._all,
            }))}
            unit="invoices"
            emptyMessage="No invoices yet. They appear here once the first one is issued."
          />
        </Panel>

        <Panel title="Overdue invoices" href="/invoices">
          {overdueInvoices.length === 0 ? (
            <p className="text-sm text-muted">Nothing overdue.</p>
          ) : (
            <ul className="divide-y divide-[var(--border)]">
              {overdueInvoices.map((inv) => (
                <li key={inv.id}>
                  <Link
                    href="/invoices"
                    className="flex items-center justify-between gap-3 py-2 text-sm hover:underline"
                  >
                    <span className="text-primary">
                      {inv.invoiceNumber} — {inv.client.name}
                    </span>
                    <span className="tabular text-xs text-muted">
                      AED {inv.totalAmount.toLocaleString()}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </div>
  );
}
