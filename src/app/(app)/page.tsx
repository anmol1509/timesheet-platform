import Link from "next/link";
import { prisma } from "@/lib/db";
import { PageHeader } from "@/components/PageHeader";
import { getComplianceAlerts } from "@/lib/dashboardAlerts";
import { getLpoAlerts } from "@/lib/lpoAlerts";
import { getWeeklyHours } from "@/lib/weeklyHours";
import { getHoursSplit } from "@/lib/attendanceHours";
import { getTimesheetPipeline } from "@/lib/timesheetPipeline";
import { getComplianceRunway } from "@/lib/complianceRunway";
import { getAssignedStaff } from "@/lib/assignedStaff";
import { getDocumentExpiryCounts } from "@/lib/documentExpiryCounts";
import { getEmployeeTypeCounts } from "@/lib/employeeTypeCounts";
import { getEntityCounts } from "@/lib/entityCounts";
import { getDeploymentPipeline } from "@/lib/deploymentPipeline";
import { getRecentActivity } from "@/lib/recentActivity";
import { getApprovalsSummary, getAttendanceToday, getDemandFill, getMoneySnapshot, getPayrollStatus } from "@/lib/dashboardExtras";
import { can } from "@/lib/permissions";
import { requireUserWithBranch, subjectOf } from "@/lib/auth";
import { branchWhere } from "@/lib/branch";
import { DASHBOARD_WIDGETS, mergeWidgetOrder, orderedVisibleWidgets, type DashboardData } from "@/lib/dashboardWidgets";
import { DashboardTabs } from "@/components/DashboardTabs";
import { Stagger, StaggerItem } from "@/components/motion";
import { CustomizeDashboardButton } from "./customize-dashboard";
import { CalendarDays, FileText, UserPlus, Upload as UploadIcon } from "lucide-react";
import { GetStarted } from "@/components/GetStarted";
import { isAdminRole } from "@/lib/roles";

function greeting() {
  const hour = Number(
    new Intl.DateTimeFormat("en-GB", { hour: "numeric", hour12: false, timeZone: "Asia/Dubai" }).format(
      new Date()
    )
  );
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

export default async function DashboardPage() {
  const { user, branchId } = await requireUserWithBranch();
  const branchScope = branchWhere(branchId);
  const firstName = user.name.trim().split(/\s+/)[0];

  const [
    employeeCount,
    onWorkCount,
    activeProjectCount,
    activeClientCount,
    alerts,
    lpoAlerts,
    weeklyHours,
    hoursSplit,
    timesheetPipeline,
    complianceRunway,
    assignedStaff,
    beds,
    latestUpload,
    months,
    documentExpiryCounts,
    employeeTypeCounts,
    entityCounts,
    deploymentPipeline,
    recentActivity,
    joinDates,
    activeProjects,
    preference,
  ] = await Promise.all([
    prisma.employee.count({ where: branchScope }),
    prisma.employee.count({
      where: { ...branchScope, active: true, projectId: { not: null } },
    }),
    prisma.project.count({ where: { ...branchScope, status: "ACTIVE" } }),
    prisma.client.count({ where: { ...branchScope, status: "ACTIVE" } }),
    getComplianceAlerts(branchId),
    getLpoAlerts(branchId),
    getWeeklyHours(branchId),
    getHoursSplit(branchId),
    getTimesheetPipeline(branchId),
    getComplianceRunway(branchId),
    getAssignedStaff(4, branchId),
    // A camp belongs to one company; rooms and beds inherit that through it.
    prisma.bed.findMany({ where: { room: { camp: branchWhere(branchId) } }, select: { employeeId: true } }),
    prisma.upload.findFirst({
      where: branchScope,
      orderBy: { uploadedAt: "desc" },
      include: { uploadedBy: true },
    }),
    prisma.timesheetEntry.findMany({
      where: branchScope,
      distinct: ["month"],
      select: { month: true },
      orderBy: { month: "desc" },
    }),
    getDocumentExpiryCounts(branchId),
    getEmployeeTypeCounts(branchId),
    getEntityCounts(branchId),
    getDeploymentPipeline(branchId),
    getRecentActivity(branchId),
    // Only the dates — enough to draw the six-month headcount line.
    prisma.employee.findMany({ where: branchScope, select: { createdAt: true } }),
    prisma.project.findMany({
      where: { ...branchScope, status: "ACTIVE" },
      select: { id: true, name: true, code: true, noOfEmployeesRequired: true, client: { select: { name: true } }, _count: { select: { employees: true } } },
      orderBy: { employees: { _count: "desc" } },
      take: 6,
    }),
    prisma.dashboardPreference.findUnique({ where: { userId: user.id } }),
  ]);

  const benchCount = employeeCount - onWorkCount;

  // Optional sections: worked out only when the person may see them and hasn't
  // switched them off, so an unused section costs nothing.
  const subject = subjectOf(user);
  const off = new Set(preference?.hiddenWidgets ?? []);
  const wantsToday = !off.has("today");
  const wantsMoneyDemand = !off.has("money-demand");
  const canInvoices = can(subject, "billing", "view");
  const canBills = can(subject, "finance", "view");
  const approvalScope = { branchId, isSuperAdmin: user.role === "SUPER_ADMIN", subject, role: user.role };
  const [approvalsSummary, attendanceToday, payrollStatus, money, demandFill] = await Promise.all([
    wantsToday ? getApprovalsSummary(approvalScope).catch(() => null) : null,
    wantsToday && can(subject, "timesheets", "view") ? getAttendanceToday(branchId).catch(() => null) : null,
    wantsToday && can(subject, "payroll", "view") ? getPayrollStatus(branchId).then((p) => ({ run: p })).catch(() => null) : null,
    wantsMoneyDemand && (canInvoices || canBills) ? getMoneySnapshot(branchId, { invoices: canInvoices, bills: canBills }).catch(() => null) : null,
    wantsMoneyDemand && can(subject, "demand", "view") ? getDemandFill(branchId).catch(() => null) : null,
  ]);

  // Headcount at the end of each of the last six months (records only ever
  // leave by being deactivated, not deleted, so created-before is headcount).
  const now = new Date();
  const monthEnds = Array.from({ length: 6 }, (_, i) => new Date(now.getFullYear(), now.getMonth() - 4 + i, 1));
  const headcountTrend = monthEnds.map((end) => joinDates.filter((e) => e.createdAt < end).length);
  headcountTrend[headcountTrend.length - 1] = employeeCount;
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const newThisMonth = joinDates.filter((e) => e.createdAt >= monthStart).length;
  const deployedPct =
    employeeCount > 0 ? Math.round((onWorkCount / employeeCount) * 100) : 0;
  const expiredCount = alerts.filter((a) => a.days < 0).length;

  const totalBeds = beds.length;
  const occupiedBeds = beds.filter((b) => b.employeeId).length;
  const vacantBeds = totalBeds - occupiedBeds;
  const occupancyPct = totalBeds > 0 ? Math.round((occupiedBeds / totalBeds) * 100) : 0;

  // Compliance and LPO warnings share one "needs attention" queue — they're the
  // same job for the user (something is about to lapse), just different sources.
  const attention = [
    ...alerts.slice(0, 6).map((a) => ({
      key: `c-${a.employeeId}-${a.field}`,
      href: `/documents?employee=${a.employeeId}`,
      title: `${a.field} — ${a.name}`,
      sub:
        a.days < 0
          ? `expired ${Math.abs(a.days)} days ago`
          : a.days === 0
            ? "expires today"
            : `expires in ${a.days} days`,
      overdue: a.days < 0,
      badge: a.days < 0 ? "Expired" : `${a.days}d`,
    })),
    ...lpoAlerts.map((a) => ({
      key: `l-${a.lpoId}-${a.kind}`,
      href: `/projects/${a.projectId}`,
      title: `${a.lpoNumber} — ${a.projectName}`,
      sub:
        a.kind === "EXPIRING"
          ? a.days != null && a.days < 0
            ? `expired ${Math.abs(a.days)} days ago`
            : `expires in ${a.days} days`
          : `AED ${a.remaining?.toLocaleString(undefined, { maximumFractionDigits: 0 })} remaining`,
      overdue: a.kind === "EXPIRING" && a.days != null && a.days < 0,
      badge: a.kind === "EXPIRING" ? "LPO expiring" : "Low balance",
    })),
  ].slice(0, 8);

  const data: DashboardData = {
    employeeCount,
    onWorkCount,
    benchCount,
    deployedPct,
    activeProjectCount,
    activeClientCount,
    alerts,
    lpoAlerts,
    expiredCount,
    attention,
    weeklyHours,
    hoursSplit,
    timesheetPipeline,
    complianceRunway,
    documentExpiryCounts,
    employeeTypeCounts,
    entityCounts,
    assignedStaff,
    totalBeds,
    occupiedBeds,
    vacantBeds,
    occupancyPct,
    latestUpload,
    months,
    deploymentPipeline,
    recentActivity,
    headcountTrend,
    newThisMonth,
    approvalsSummary,
    attendanceToday,
    payrollStatus,
    money,
    demandFill,
    activeProjects: activeProjects.map((p) => ({ id: p.id, name: p.name, code: p.code, clientName: p.client.name, workers: p._count.employees, required: p.noOfEmployeesRequired })),
  };

  const hiddenWidgets = preference?.hiddenWidgets ?? [];
  const fullOrder = mergeWidgetOrder(preference?.widgetOrder ?? []);
  const visibleWidgets = orderedVisibleWidgets(hiddenWidgets, fullOrder);

  return (
    <div className="space-y-5">
      <PageHeader
        title={`${greeting()}, ${firstName}`}
        description={
          <span className="inline-flex flex-wrap items-center gap-x-3 gap-y-1">
            <span>Here&apos;s what needs your attention today.</span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-default bg-surface px-2.5 py-0.5 text-xs font-medium text-secondary shadow-xs">
              <CalendarDays className="h-3.5 w-3.5 text-subtle" aria-hidden />
              {new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Dubai" }).format(new Date())}
            </span>
          </span>
        }
        actions={
          <>
            <CustomizeDashboardButton
              widgets={DASHBOARD_WIDGETS.map((w) => ({ id: w.id, label: w.label }))}
              initialOrder={fullOrder}
              initialHidden={hiddenWidgets}
            />
            <Link
              href="/import"
              className="inline-flex h-8 items-center gap-1.5 rounded-control border border-strong bg-surface px-2.5 text-xs font-medium text-secondary shadow-xs transition hover:bg-surface-hover hover:text-primary"
            >
              <UploadIcon className="h-3.5 w-3.5" aria-hidden />
              Upload data
            </Link>
            <Link
              href="/companies"
              className="inline-flex h-8 items-center gap-1.5 rounded-control border border-strong bg-surface px-2.5 text-xs font-medium text-secondary shadow-xs transition hover:bg-surface-hover hover:text-primary"
            >
              <FileText className="h-3.5 w-3.5" aria-hidden />
              Generate timesheets
            </Link>
            <Link
              href="/employees/new"
              className="btn btn-primary btn-sm h-8 gap-1.5 rounded-control shadow-xs"
            >
              <UserPlus className="h-3.5 w-3.5" aria-hidden />
              Add employee
            </Link>
          </>
        }
      />

      {branchId && isAdminRole(user.role) && <GetStarted branchId={branchId} compact />}

      <DashboardTabs />

      <Stagger className="space-y-5">
        {visibleWidgets.map((widget) => (
          <StaggerItem key={widget.id}>{widget.render(data)}</StaggerItem>
        ))}
      </Stagger>
    </div>
  );
}
