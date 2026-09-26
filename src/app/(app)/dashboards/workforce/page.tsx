import { prisma } from "@/lib/db";
import { PageHeader } from "@/components/PageHeader";
import { DashboardTabs } from "@/components/DashboardTabs";
import { KpiStrip } from "@/components/KpiStrip";
import { Panel } from "@/components/DashboardPanel";
import { DocumentExpiryWidget } from "@/components/DocumentExpiryWidget";
import { EmployeeTypeBreakdown } from "@/components/EmployeeTypeBreakdown";
import { ComplianceRunway } from "@/components/ComplianceRunway";
import { getComplianceRunway } from "@/lib/complianceRunway";
import { getComplianceAlerts } from "@/lib/dashboardAlerts";
import { getDocumentExpiryCounts } from "@/lib/documentExpiryCounts";
import { getEmployeeTypeCounts } from "@/lib/employeeTypeCounts";
import { requireUserWithBranch } from "@/lib/auth";
import { branchWhere } from "@/lib/branch";
import { BarList } from "@/components/BarList";
import { Nationality } from "@/components/Nationality";
import { AlertTriangle, Globe2, HardHat, Users } from "lucide-react";

export default async function WorkforceDashboardPage() {
  const { branchId } = await requireUserWithBranch();
  const branchScope = branchWhere(branchId);

  const [
    employeeCount,
    onWorkCount,
    terminatedCount,
    alerts,
    documentExpiryCounts,
    employeeTypeCounts,
    runway,
    byTrade,
    byNationality,
  ] = await Promise.all([
    prisma.employee.count({ where: branchScope }),
    prisma.employee.count({
      where: { ...branchScope, active: true, projectId: { not: null } },
    }),
    prisma.employee.count({ where: { ...branchScope, status: "TERMINATED" } }),
    getComplianceAlerts(branchId),
    getDocumentExpiryCounts(branchId),
    getEmployeeTypeCounts(branchId),
    getComplianceRunway(branchId),
    prisma.employee.groupBy({
      by: ["trade"],
      where: { ...branchScope, status: { not: "TERMINATED" } },
      _count: { _all: true },
      orderBy: { _count: { trade: "desc" } },
      take: 8,
    }),
    prisma.employee.groupBy({
      by: ["nationality"],
      where: { ...branchScope, status: { not: "TERMINATED" } },
      _count: { _all: true },
      orderBy: { _count: { nationality: "desc" } },
      take: 8,
    }),
  ]);

  const benchCount = employeeCount - onWorkCount;
  const expiredCount = alerts.filter((a) => a.days < 0).length;

  return (
    <div className="space-y-5">
      <PageHeader
        icon={Users}
        title="Workforce overview"
        description="Headcount, deployment and document compliance."
      />
      <DashboardTabs />

      <KpiStrip
        cells={[
          {
            label: "Total employees",
            value: employeeCount,
            sub: `${onWorkCount} deployed · ${benchCount} on bench`,
            href: "/employees",
          },
          {
            label: "Deployed",
            value: onWorkCount,
            sub: `${benchCount} on bench`,
            href: "/employees?filter=on-work",
          },
          {
            label: "Compliance alerts",
            value: alerts.length,
            sub:
              expiredCount > 0
                ? `${expiredCount} expired`
                : "expiring within 30 days",
            href: "/documents",
            tone:
              alerts.length > 0 ? ("warning" as const) : ("default" as const),
          },
          {
            label: "Terminated",
            value: terminatedCount,
            sub: "no longer active",
            href: "/employees",
          },
        ]}
      />

      <Panel
        title="Compliance runway"
        icon={AlertTriangle}
        href="/employees/renewals"
        linkLabel="Renewals"
      >
        <ComplianceRunway runway={runway} />
      </Panel>

      <section>
        <h2 className="mb-2.5 text-sm font-semibold text-primary">
          Document expiry
        </h2>
        <DocumentExpiryWidget categories={documentExpiryCounts} />
      </section>

      <Panel title="Workforce by type" href="/employees">
        <EmployeeTypeBreakdown counts={employeeTypeCounts} />
      </Panel>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Panel title="Workforce by trade" icon={HardHat} href="/trades" linkLabel="Trades">
          <BarList
            tone="brand"
            items={byTrade.map((r) => ({ key: r.trade ?? "none", label: r.trade ?? "No trade set", value: r._count._all }))}
            emptyLabel="No employees yet."
          />
        </Panel>
        <Panel title="Workforce by nationality" icon={Globe2} href="/employees">
          <BarList
            tone="info"
            items={byNationality.map((r) => ({ key: r.nationality ?? "none", label: <Nationality name={r.nationality ?? "Not set"} />, value: r._count._all }))}
            emptyLabel="No employees yet."
          />
        </Panel>
      </div>
    </div>
  );
}
