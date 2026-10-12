import { prisma } from "@/lib/db";
import { PageHeader } from "@/components/PageHeader";
import { WorkforceExtras } from "@/components/dashboard/ModuleExtras";
import { isAdminRole } from "@/lib/roles";
import { Sec } from "@/components/dashboard/Sec";
import { CustomizeSections } from "@/components/dashboard/CustomizeSections";
import { getHiddenSections } from "@/lib/dashboardSections";
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
import { Treemap } from "@/components/Treemap";
import { AlertTriangle, Globe2, HardHat, Users } from "lucide-react";

export default async function WorkforceDashboardPage() {
  const { user, branchId } = await requireUserWithBranch();
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

  const hiddenSections = await getHiddenSections(user.id, "workforce");

  return (
    <div className="space-y-5">
      <PageHeader
        icon={Users}
        title="Workforce overview"
        description="Headcount, deployment and document compliance."
      actions={<CustomizeSections module="workforce" sections={[{ id: "runway", label: "Compliance runway" }, { id: "documents", label: "Document expiry" }, { id: "type", label: "Workforce by type" }, { id: "breakdown", label: "Trade and nationality" }, { id: "extras", label: "Bench, movement and data health" }]} hidden={[...hiddenSections]} />}
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

      <Sec id="runway" hidden={hiddenSections}>
      <Panel
        title="Compliance runway"
        icon={AlertTriangle}
        href="/employees/renewals"
        linkLabel="Renewals"
      >
        <ComplianceRunway runway={runway} />
      </Panel>
      </Sec>

      <Sec id="documents" hidden={hiddenSections}>
      <section>
        <h2 className="mb-2.5 text-sm font-semibold text-primary">
          Document expiry
        </h2>
        <DocumentExpiryWidget categories={documentExpiryCounts} />
      </section>
      </Sec>

      <Sec id="type" hidden={hiddenSections}>
      <Panel title="Workforce by type" href="/employees">
        <EmployeeTypeBreakdown counts={employeeTypeCounts} />
      </Panel>
      </Sec>

      <Sec id="breakdown" hidden={hiddenSections}>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Panel title="Workforce by trade" icon={HardHat} href="/trades" linkLabel="Trades">
          <BarList
            tone="brand"
            items={byTrade.map((r) => ({ key: r.trade ?? "none", label: r.trade ?? "No trade set", value: r._count._all, href: r.trade ? `/employees?trade=${encodeURIComponent(r.trade)}` : undefined }))}
            emptyLabel="No employees yet."
          />
        </Panel>
        <Panel title="Workforce by nationality" icon={Globe2} href="/employees">
          {byNationality.length === 1 ? (
            // One block filling the whole card says nothing a sentence doesn't.
            <p className="py-10 text-center text-sm text-muted">
              All {byNationality[0]._count._all} workers are <span className="font-medium text-primary">{byNationality[0].nationality ?? "not set"}</span>.
            </p>
          ) : (
            <Treemap
              items={byNationality.map((r) => ({ key: r.nationality ?? "none", label: r.nationality ?? "Not set", value: r._count._all, href: r.nationality ? `/employees?nationality=${encodeURIComponent(r.nationality)}` : undefined }))}
              emptyLabel="No employees yet."
            />
          )}
        </Panel>
      </div>
      </Sec>

      <Sec id="extras" hidden={hiddenSections}>
      <WorkforceExtras branchId={branchId} isAdmin={isAdminRole(user.role)} />
      </Sec>
    </div>
  );
}
