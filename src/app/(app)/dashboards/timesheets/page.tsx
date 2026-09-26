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

function monthKey(d: Date) {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export default async function TimesheetsDashboardPage() {
  const { branchId } = await requireUserWithBranch();
  const branchScope = branchWhere(branchId);
  const month = currentMonthKey();
  const today = new Date();
  const sixMonthsAgo = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - 5, 1));

  const [
    thisMonthCount,
    statusBreakdown,
    lockedCount,
    attendanceToday,
    pipeline,
    hoursSplit,
    recentAttendance,
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
    prisma.attendance.findMany({
      where: { ...branchScope, date: { gte: sixMonthsAgo } },
      select: { date: true, normalHours: true, otHours: true },
    }),
  ]);

  const months = Array.from({ length: 6 }, (_, i) => monthKey(new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - 5 + i, 1))));
  const normalByMonth = new Map(months.map((m) => [m, 0]));
  const otByMonth = new Map(months.map((m) => [m, 0]));
  for (const a of recentAttendance) {
    const k = monthKey(a.date);
    if (!normalByMonth.has(k)) continue;
    normalByMonth.set(k, (normalByMonth.get(k) ?? 0) + (a.normalHours ?? 0));
    otByMonth.set(k, (otByMonth.get(k) ?? 0) + (a.otHours ?? 0));
  }
  const monthlyMax = Math.max(1, ...months.map((m) => (normalByMonth.get(m) ?? 0) + (otByMonth.get(m) ?? 0)));

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

      <Panel title="Hours, last 6 months" href="/attendance">
        <div className="mb-3 flex items-center gap-3 text-xs text-muted">
          <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-[var(--brand-primary)]" />Normal</span>
          <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-[var(--warning)]" />Overtime</span>
        </div>
        <div className="flex h-32 items-end gap-3">
          {months.map((m) => {
            const normal = normalByMonth.get(m) ?? 0;
            const ot = otByMonth.get(m) ?? 0;
            const total = normal + ot;
            return (
              <div key={m} className="flex flex-1 flex-col items-center gap-1" title={`${m}: ${normal}h normal, ${ot}h OT`}>
                {total > 0 && <span className="tabular text-[11px] text-secondary">{Math.round(total)}h</span>}
                <div className="flex w-full max-w-10 flex-col-reverse overflow-hidden rounded-t-[4px]" style={{ height: `${Math.max(total > 0 ? 6 : 2, (total / monthlyMax) * 88)}px` }}>
                  {normal > 0 && <span className="w-full bg-[var(--brand-primary)]" style={{ height: `${(normal / total) * 100}%` }} />}
                  {ot > 0 && <span className="w-full bg-[var(--warning)]" style={{ height: `${(ot / total) * 100}%` }} />}
                </div>
                <span className="text-xs text-subtle">{m.slice(5)}</span>
              </div>
            );
          })}
        </div>
      </Panel>
    </div>
  );
}
