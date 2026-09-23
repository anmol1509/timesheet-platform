import { prisma } from "@/lib/db";
import { PageHeader } from "@/components/PageHeader";
import { DashboardTabs } from "@/components/DashboardTabs";
import { StatTile } from "@/components/StatTile";
import { Stagger, StaggerItem } from "@/components/motion";
import { Panel } from "@/components/DashboardPanel";
import { HoursSplitChart } from "@/components/HoursSplitChart";
import { TimesheetPipelineChart } from "@/components/TimesheetPipelineChart";
import { getHoursSplit } from "@/lib/attendanceHours";
import { getTimesheetPipeline } from "@/lib/timesheetPipeline";
import { requireUserWithBranch } from "@/lib/auth";
import { branchWhere } from "@/lib/branch";
import { FileSpreadsheet, Clock, CheckCircle2, Lock } from "lucide-react";

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
    prisma.timesheetEntry.groupBy({ by: ["status"], where: branchScope, _count: { _all: true } }),
    prisma.timesheetEntry.count({ where: { ...branchScope, status: "LOCKED" } }),
    prisma.attendance.count({
      where: { ...branchScope, date: { gte: new Date(new Date().toDateString()) } },
    }),
    getTimesheetPipeline(branchId),
    getHoursSplit(branchId),
  ]);

  return (
    <div className="space-y-5">
      <PageHeader title="Dashboard" description="This month's timesheet volume and status." />
      <DashboardTabs />

      <Stagger className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StaggerItem>
          <StatTile href="/invoices/client-timesheet" label="This Month's Rows" value={thisMonthCount} icon={FileSpreadsheet} />
        </StaggerItem>
        <StaggerItem>
          <StatTile href="/attendance" label="Marked Today" value={attendanceToday} icon={Clock} />
        </StaggerItem>
        <StaggerItem>
          <StatTile href="/invoices/client-timesheet" label="Locked" value={lockedCount} icon={Lock} />
        </StaggerItem>
        <StaggerItem>
          <StatTile
          href="/invoices/client-timesheet"
          label="Approved"
          value={statusBreakdown.find((s) => s.status === "CLIENT_APPROVED")?._count._all ?? 0}
          icon={CheckCircle2}
        />
        </StaggerItem>
      </Stagger>

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
