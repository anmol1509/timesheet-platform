import { TrendingUp } from "lucide-react";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { PageHeader } from "@/components/PageHeader";
import { SalesExtras } from "@/components/dashboard/ModuleExtras";
import { PeriodPicker } from "@/components/dashboard/PeriodSelect";
import { PERIOD_OPTIONS, resolvePeriod } from "@/lib/dashboardPeriod";
import { Sec } from "@/components/dashboard/Sec";
import { CustomizeSections } from "@/components/dashboard/CustomizeSections";
import { getHiddenSections } from "@/lib/dashboardSections";
import { DashboardTabs } from "@/components/DashboardTabs";
import { KpiStrip } from "@/components/KpiStrip";
import { Panel } from "@/components/DashboardPanel";
import { StatusDonut, CategoryDonut } from "@/components/Donut";
import { requireUserWithBranch } from "@/lib/auth";
import { branchWhere } from "@/lib/branch";

export default async function SalesDashboardPage({ searchParams }: { searchParams: Promise<{ period?: string; from?: string; to?: string }> }) {
  const { user, branchId } = await requireUserWithBranch();
  const sp = await searchParams;
  const period = resolvePeriod(sp.period, "90d", { from: sp.from, to: sp.to });
  const branchScope = branchWhere(branchId);
  // Enquiries and quotations are counted by when they were created. Quotations
  // expiring soon and the open pipeline look forward from today instead.
  const inPeriod = { ...branchScope, createdAt: { gte: period.from, lt: period.to } };

  const [
    openEnquiries,
    enquiriesBySource,
    quotationsByStatus,
    totalQuotations,
    convertedCount,
    expiringSoon,
  ] = await Promise.all([
    prisma.enquiry.count({ where: { ...inPeriod, status: "Open" } }),
    prisma.enquiry.groupBy({
      by: ["source"],
      where: inPeriod,
      _count: { _all: true },
    }),
    prisma.quotation.groupBy({
      by: ["status"],
      where: inPeriod,
      _count: { _all: true },
    }),
    prisma.quotation.count({ where: inPeriod }),
    prisma.quotation.count({ where: { ...inPeriod, status: "CONVERTED" } }),
    prisma.quotation.findMany({
      where: {
        ...branchScope,
        status: { in: ["SENT", "NEGOTIATION", "APPROVED"] },
        validUntil: { lte: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000) },
      },
      select: {
        id: true,
        quotationNumber: true,
        status: true,
        validUntil: true,
        client: { select: { name: true } },
      },
      orderBy: { validUntil: "asc" },
      take: 10,
    }),
  ]);

  const conversionPct =
    totalQuotations > 0
      ? Math.round((convertedCount / totalQuotations) * 100)
      : 0;

  const hiddenSections = await getHiddenSections(user.id, "sales");

  return (
    <div className="space-y-5">
      <PageHeader
        icon={TrendingUp}
        title="Sales overview"
        description={`Enquiries and quotations created ${period.label.toLowerCase()}. Expiring quotations and the open pipeline look ahead from today.`}
        actions={<><PeriodPicker value={period.key} from={sp.from} to={sp.to} options={PERIOD_OPTIONS} /><CustomizeSections module="sales" sections={[{ id: "overview", label: "Quotations and enquiries" }, { id: "expiring", label: "Quotations expiring" }, { id: "extras", label: "Pipeline and win rate" }]} hidden={[...hiddenSections]} /></>}
      />
      <DashboardTabs />

      <KpiStrip
        cells={[
          {
            label: "Open enquiries",
            value: openEnquiries,
            sub: "awaiting a quote",
            href: "/sales/enquiries",
          },
          {
            label: "Total quotations",
            value: totalQuotations,
            sub: "created in the period",
            href: "/sales/quotations",
          },
          {
            label: "Converted",
            value: convertedCount,
            suffix: "%",
            sub: `${conversionPct}% conversion`,
            href: "/sales/quotations",
            meter: conversionPct,
          },
          {
            label: "Expiring soon",
            value: expiringSoon.length,
            sub: "quotations about to lapse",
            href: "/sales/quotations",
            tone:
              expiringSoon.length > 0
                ? ("warning" as const)
                : ("default" as const),
          },
        ]}
      />

      <Sec id="overview" hidden={hiddenSections}>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Panel title="Quotations by status" href="/sales/quotations">
          <StatusDonut
            items={quotationsByStatus.map((r) => ({
              status: r.status,
              count: r._count._all,
            }))}
            emptyMessage="No quotations yet."
          />
        </Panel>

        <Panel title="Enquiries by source" href="/sales/enquiries">
          <CategoryDonut
            items={enquiriesBySource.map((r) => ({
              key: r.source ?? "none",
              label: r.source ?? "Not set",
              count: r._count._all,
            }))}
            emptyMessage="No enquiries yet."
          />
        </Panel>
      </div>
      </Sec>

      <Sec id="expiring" hidden={hiddenSections}>
      <Panel
        title="Quotations expiring within 14 days"
        href="/sales/quotations"
      >
        {expiringSoon.length === 0 ? (
          <p className="text-sm text-muted">Nothing expiring soon.</p>
        ) : (
          <ul className="divide-y divide-[var(--border)]">
            {expiringSoon.map((q) => (
              <li key={q.id}>
                <Link
                  href={`/sales/quotations/${q.id}`}
                  className="flex items-center justify-between gap-3 py-2 text-sm hover:underline"
                >
                  <span className="text-primary">
                    {q.quotationNumber} — {q.client.name}
                  </span>
                  <span className="text-xs text-muted">
                    {q.validUntil?.toLocaleDateString("en-GB")}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Panel>
      </Sec>

      <Sec id="extras" hidden={hiddenSections}>
      <SalesExtras branchId={branchId} period={period} />
      </Sec>
    </div>
  );
}
