import { Receipt } from "lucide-react";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { PageHeader } from "@/components/PageHeader";
import { BillingExtras } from "@/components/dashboard/ModuleExtras";
import { PeriodPicker } from "@/components/dashboard/PeriodSelect";
import { PERIOD_OPTIONS, resolvePeriod } from "@/lib/dashboardPeriod";
import { Sec } from "@/components/dashboard/Sec";
import { CustomizeSections } from "@/components/dashboard/CustomizeSections";
import { getHiddenSections } from "@/lib/dashboardSections";
import { DashboardTabs } from "@/components/DashboardTabs";
import { KpiStrip } from "@/components/KpiStrip";
import { Panel } from "@/components/DashboardPanel";
import { StatusDonut } from "@/components/Donut";
import { BarList } from "@/components/BarList";
import { requireUserWithBranch } from "@/lib/auth";
import { branchWhere } from "@/lib/branch";

export default async function BillingDashboardPage({ searchParams }: { searchParams: Promise<{ period?: string; from?: string; to?: string }> }) {
  const { user, branchId } = await requireUserWithBranch();
  const sp = await searchParams;
  const period = resolvePeriod(sp.period, "this-month", { from: sp.from, to: sp.to });
  const branchScope = branchWhere(branchId);
  // Every figure on this page is for invoices issued in the chosen period;
  // "Unpaid invoices by age" at the bottom is the exception and shows what is
  // still unpaid today, whenever it was issued.
  const inPeriod = { ...branchScope, issueDate: { gte: period.from, lt: period.to } };

  const [statusBreakdown, outstanding, overdueInvoices, byClient, clients] = await Promise.all([
    prisma.clientInvoice.groupBy({
      by: ["status"],
      where: inPeriod,
      _count: { _all: true },
      _sum: { totalAmount: true },
    }),
    prisma.clientInvoice.aggregate({
      where: { ...inPeriod, status: { not: "PAID" } },
      _sum: { totalAmount: true },
    }),
    prisma.clientInvoice.findMany({
      where: { ...inPeriod, status: "OVERDUE" },
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
      where: inPeriod,
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

  const hiddenSections = await getHiddenSections(user.id, "billing");

  return (
    <div className="space-y-5">
      <PageHeader
        icon={Receipt}
        title="Billing overview"
        description={`Invoices issued ${period.label.toLowerCase()}. The age of unpaid invoices at the bottom covers everything still unpaid today.`}
        actions={<><PeriodPicker value={period.key} from={sp.from} to={sp.to} options={PERIOD_OPTIONS} /><CustomizeSections module="billing" sections={[{ id: "overview", label: "Clients, status and overdue" }, { id: "extras", label: "Ageing and collections" }]} hidden={[...hiddenSections]} /></>}
      />
      <DashboardTabs />

      <KpiStrip
        cells={[
          {
            label: "Total invoices",
            value: totalInvoices,
            sub: "issued in the period",
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

      <Sec id="overview" hidden={hiddenSections}>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Panel title="Invoiced by client" href="/invoices/history" className="lg:col-span-2">
          <BarList
            tone="info"
            items={byClient.map((r) => {
              const total = Math.round(r._sum.totalAmount ?? 0);
              return {
                key: r.clientId,
                label: clientName.get(r.clientId) ?? "Unknown client",
                value: total,
                valueLabel: `AED ${total.toLocaleString("en-AE")}`,
                href: `/clients/${r.clientId}`,
              };
            })}
            emptyLabel="No invoices yet."
          />
        </Panel>

        <Panel title="Invoices by status" href="/invoices">
          <StatusDonut
            items={statusBreakdown.map((r) => ({
              status: r.status,
              count: r._count._all,
            }))}
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
      </Sec>

      <Sec id="extras" hidden={hiddenSections}>
      <BillingExtras branchId={branchId} period={period} />
      </Sec>
    </div>
  );
}
