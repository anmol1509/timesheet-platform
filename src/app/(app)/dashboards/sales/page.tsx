import { TrendingUp } from "lucide-react";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { PageHeader } from "@/components/PageHeader";
import { DashboardTabs } from "@/components/DashboardTabs";
import { KpiStrip } from "@/components/KpiStrip";
import { Panel } from "@/components/DashboardPanel";
import { StatusDonut, CategoryDonut } from "@/components/Donut";
import { requireUserWithBranch } from "@/lib/auth";
import { branchWhere } from "@/lib/branch";

export default async function SalesDashboardPage() {
  const { branchId } = await requireUserWithBranch();
  const branchScope = branchWhere(branchId);

  const [
    openEnquiries,
    enquiriesBySource,
    quotationsByStatus,
    totalQuotations,
    convertedCount,
    expiringSoon,
  ] = await Promise.all([
    prisma.enquiry.count({ where: { ...branchScope, status: "Open" } }),
    prisma.enquiry.groupBy({
      by: ["source"],
      where: branchScope,
      _count: { _all: true },
    }),
    prisma.quotation.groupBy({
      by: ["status"],
      where: branchScope,
      _count: { _all: true },
    }),
    prisma.quotation.count({ where: branchScope }),
    prisma.quotation.count({ where: { ...branchScope, status: "CONVERTED" } }),
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

  return (
    <div className="space-y-5">
      <PageHeader
        icon={TrendingUp}
        title="Sales overview"
        description="Enquiries, quotations and conversion."
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
            sub: "all time",
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
    </div>
  );
}
