import { prisma } from "@/lib/db";
import { PageHeader } from "@/components/PageHeader";
import { DashboardTabs } from "@/components/DashboardTabs";
import { StatTile } from "@/components/StatTile";
import { Stagger, StaggerItem } from "@/components/motion";
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
import { Users, ClipboardList, AlertTriangle, UserX } from "lucide-react";

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
  ] = await Promise.all([
    prisma.employee.count({ where: branchScope }),
    prisma.employee.count({ where: { ...branchScope, active: true, projectId: { not: null } } }),
    prisma.employee.count({ where: { ...branchScope, status: "TERMINATED" } }),
    getComplianceAlerts(branchId),
    getDocumentExpiryCounts(branchId),
    getEmployeeTypeCounts(branchId),
    getComplianceRunway(branchId),
  ]);

  const benchCount = employeeCount - onWorkCount;
  const expiredCount = alerts.filter((a) => a.days < 0).length;

  return (
    <div className="space-y-5">
      <PageHeader title="Dashboard" description="Headcount, deployment, and document compliance." />
      <DashboardTabs />

      <Stagger className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StaggerItem>
          <StatTile href="/employees" label="Total Employees" value={employeeCount} icon={Users} />
        </StaggerItem>
        <StaggerItem>
          <StatTile href="/employees?filter=on-work" label="Deployed" value={onWorkCount} icon={ClipboardList} hint={`${benchCount} on bench`} />
        </StaggerItem>
        <StaggerItem>
          <StatTile
          href="/documents"
          label="Compliance Alerts"
          value={alerts.length}
          icon={AlertTriangle}
          tone={expiredCount > 0 ? "warning" : "default"}
          hint={expiredCount > 0 ? `${expiredCount} expired` : "expiring within 30 days"}
        />
        </StaggerItem>
        <StaggerItem>
          <StatTile href="/employees" label="Terminated" value={terminatedCount} icon={UserX} />
        </StaggerItem>
      </Stagger>

      <Panel
        title="Compliance runway"
        icon={AlertTriangle}
        href="/employees/renewals"
        linkLabel="Renewals"
      >
        <ComplianceRunway runway={runway} />
      </Panel>

      <section>
        <h2 className="mb-2.5 text-sm font-semibold text-primary">Document expiry</h2>
        <DocumentExpiryWidget categories={documentExpiryCounts} />
      </section>

      <Panel title="Workforce by type" href="/employees">
        <EmployeeTypeBreakdown counts={employeeTypeCounts} />
      </Panel>
    </div>
  );
}
