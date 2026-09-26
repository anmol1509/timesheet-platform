import { FileSpreadsheet } from "lucide-react";
import { prisma } from "@/lib/db";
import { PageHeader } from "@/components/PageHeader";
import { DashboardTabs } from "@/components/DashboardTabs";
import { KpiStrip } from "@/components/KpiStrip";
import { Panel } from "@/components/DashboardPanel";
import { HoursSplitChart } from "@/components/HoursSplitChart";
import { TimesheetPipelineChart } from "@/components/TimesheetPipelineChart";
import { getHoursSplit } from "@/lib/attendanceHours";
import { getTimesheetPipeline } from "@/lib/timesheetPipeline";
import { requireUserWithBranch } from "@/lib/auth";
import { branchWhere } from "@/lib/branch";

function currentMonthKey() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

export default async function TimesheetsDashboardPage() {
  const { branchId } = await requireUserWithBranch();
  const branchScope = branchWhere(branchId);
  const month = currentMonthKey();

  const [
    thisMonthCount,
    statusBreakdown,
    lockedCount,
    attendanceToday,
    pipeline,
    hoursSplit,
  ] = await Promise.all([
    prisma.timesheetEntry.count({ where: { ...branchScope, month } }),
    prisma.timesheetEntry.groupBy({
      by: ["status"],
      where: branchScope,
      _count: { _all: true },
    }),
    prisma.timesheetEntry.count({
      where: { ...branchScope, status: "LOCKED" },
    }),
    prisma.attendance.count({
      where: {
        ...branchScope,
        date: { gte: new Date(new Date().toDateString()) },
      },
    }),
    getTimesheetPipeline(branchId),
    getHoursSplit(branchId),
  ]);

  return (
    <div className="space-y-5">
      <PageHeader
        icon={FileSpreadsheet}
        title="Timesheets overview"
        description="Hours, approvals and attendance."
      />
      <DashboardTabs />

      <KpiStrip
        cells={[
          {
            label: "This month's rows",
            value: thisMonthCount,
            sub: "timesheet entries",
            href: "/invoices/client-timesheet",
          },
          {
            label: "Marked today",
            value: attendanceToday,
            sub: "attendance records",
            href: "/attendance",
          },
          {
            label: "Locked",
            value: lockedCount,
            sub: "invoiced and frozen",
            href: "/invoices/client-timesheet",
          },
          {
            label: "Approved",
            value:
              statusBreakdown.find((s) => s.status === "CLIENT_APPROVED")
                ?._count._all ?? 0,
            sub: "ready to invoice",
            href: "/invoices/client-timesheet",
          },
        ]}
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Panel
          title="Hours — normal vs overtime"
          className="lg:col-span-2"
          href="/attendance"
          linkLabel="Attendance"
        >
          <HoursSplitChart split={hoursSplit} />
        </Panel>

        <Panel title="Timesheet pipeline" href="/invoices/client-timesheet">
          <TimesheetPipelineChart pipeline={pipeline} />
        </Panel>
      </div>
    </div>
  );
}
