import Link from "next/link";
import { prisma } from "@/lib/db";
import { PageHeader } from "@/components/PageHeader";
import { DashboardTabs } from "@/components/DashboardTabs";
import { StatTile } from "@/components/StatTile";
import { Stagger, StaggerItem } from "@/components/motion";
import { Panel } from "@/components/DashboardPanel";
import { Badge } from "@/components/Badge";
import { requireUserWithBranch } from "@/lib/auth";
import { branchWhere } from "@/lib/branch";
import { FileQuestion, FileSignature, TrendingUp, Clock } from "lucide-react";

const STATUS_COLOR: Record<string, "slate" | "amber" | "green" | "red" | "blue"> = {
  DRAFT: "slate",
  SENT: "blue",
  NEGOTIATION: "amber",
  APPROVED: "green",
  ACCEPTED: "green",
  REJECTED: "red",
  CONVERTED: "green",
};

export default async function SalesDashboardPage() {
  const { branchId } = await requireUserWithBranch();
  const branchScope = branchWhere(branchId);

  const [openEnquiries, quotationsByStatus, totalQuotations, convertedCount, expiringSoon] = await Promise.all([
    prisma.enquiry.count({ where: { ...branchScope, status: "Open" } }),
    prisma.quotation.groupBy({ by: ["status"], where: branchScope, _count: { _all: true } }),
    prisma.quotation.count({ where: branchScope }),
    prisma.quotation.count({ where: { ...branchScope, status: "CONVERTED" } }),
    prisma.quotation.findMany({
      where: {
        ...branchScope,
        status: { in: ["SENT", "NEGOTIATION", "APPROVED"] },
        validUntil: { lte: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000) },
      },
      select: { id: true, quotationNumber: true, status: true, validUntil: true, client: { select: { name: true } } },
      orderBy: { validUntil: "asc" },
      take: 10,
    }),
  ]);

  const conversionPct = totalQuotations > 0 ? Math.round((convertedCount / totalQuotations) * 100) : 0;

  return (
    <div className="space-y-5">
      <PageHeader title="Dashboard" description="Enquiries and quotation pipeline." />
      <DashboardTabs />

      <Stagger className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StaggerItem>
          <StatTile href="/sales/enquiries" label="Open Enquiries" value={openEnquiries} icon={FileQuestion} />
        </StaggerItem>
        <StaggerItem>
          <StatTile href="/sales/quotations" label="Total Quotations" value={totalQuotations} icon={FileSignature} />
        </StaggerItem>
        <StaggerItem>
          <StatTile href="/sales/quotations" label="Converted" value={convertedCount} icon={TrendingUp} hint={`${conversionPct}% conversion`} />
        </StaggerItem>
        <StaggerItem>
          <StatTile href="/sales/quotations" label="Expiring Soon" value={expiringSoon.length} icon={Clock} tone={expiringSoon.length > 0 ? "warning" : "default"} />
        </StaggerItem>
      </Stagger>

      <Panel title="Quotations by status">
        <ul className="space-y-1.5">
          {quotationsByStatus.map((row) => (
            <li key={row.status} className="flex items-center justify-between text-sm">
              <Badge color={STATUS_COLOR[row.status] ?? "slate"}>{row.status}</Badge>
              <span className="tabular font-semibold text-primary">{row._count._all}</span>
            </li>
          ))}
        </ul>
      </Panel>

      <Panel title="Quotations expiring within 14 days" href="/sales/quotations">
        {expiringSoon.length === 0 ? (
          <p className="text-sm text-muted">Nothing expiring soon.</p>
        ) : (
          <ul className="divide-y divide-[var(--border)]">
            {expiringSoon.map((q) => (
              <li key={q.id}>
                <Link href={`/sales/quotations/${q.id}`} className="flex items-center justify-between gap-3 py-2 text-sm hover:underline">
                  <span className="text-primary">{q.quotationNumber} — {q.client.name}</span>
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
