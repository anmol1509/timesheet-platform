import { FileSpreadsheet } from "lucide-react";
import { prisma } from "@/lib/db";
import { PageHeader } from "@/components/PageHeader";
import { PeriodPicker } from "@/components/dashboard/PeriodSelect";
import { PERIOD_OPTIONS, monthKeysIn, resolvePeriod } from "@/lib/dashboardPeriod";
import { TimesheetsExtras } from "@/components/dashboard/ModuleExtras";
import { Sec } from "@/components/dashboard/Sec";
import { CustomizeSections } from "@/components/dashboard/CustomizeSections";
import { getHiddenSections } from "@/lib/dashboardSections";
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

export default async function TimesheetsDashboardPage({ searchParams }: { searchParams: Promise<{ period?: string; from?: string; to?: string }> }) {
  const { user, branchId } = await requireUserWithBranch();
  const branchScope = branchWhere(branchId);
  const sp = await searchParams;
  const period = resolvePeriod(sp.period, "this-month", { from: sp.from, to: sp.to });
  // Timesheet rows belong to a month, so a range covers every month it touches;
  // the pipeline and the six-month chart end at the range's last month.
  const rowMonths = monthKeysIn(period);
  const month = rowMonths[rowMonths.length - 1];
  const isCurrent = period.key === "this-month";
  const today = new Date();
  const [selY, selM] = month.split("-").map(Number);
  const sixMonthsAgo = new Date(Date.UTC(selY, selM - 6, 1));
  const windowEnd = new Date(Date.UTC(selY, selM, 1));

  const [
    thisMonthCount,
    statusBreakdown,
    lockedCount,
    attendanceToday,
    pipeline,
    hoursSplit,
    recentAttendance,
  ] = await Promise.all([
    prisma.timesheetEntry.count({ where: { ...branchScope, month: { in: rowMonths } } }),
    prisma.timesheetEntry.groupBy({
      by: ["status"],
      where: { ...branchScope, month: { in: rowMonths } },
      _count: { _all: true },
    }),
    prisma.timesheetEntry.count({
      where: { ...branchScope, month: { in: rowMonths }, status: "LOCKED" },
    }),
    prisma.attendance.count({
      where: isCurrent
        ? { ...branchScope, date: { gte: new Date(new Date().toDateString()) } }
        : { ...branchScope, date: { gte: period.from, lt: period.to } },
    }),
    getTimesheetPipeline(branchId, month),
    getHoursSplit(branchId, { from: period.from, to: period.to }),
    prisma.attendance.findMany({
      where: { ...branchScope, date: { gte: sixMonthsAgo, lt: windowEnd } },
      select: { date: true, normalHours: true, otHours: true },
    }),
  ]);

  const months = Array.from({ length: 6 }, (_, i) => monthKey(new Date(Date.UTC(selY, selM - 6 + i, 1))));
  const normalByMonth = new Map(months.map((m) => [m, 0]));
  const otByMonth = new Map(months.map((m) => [m, 0]));
  for (const a of recentAttendance) {
    const k = monthKey(a.date);
    if (!normalByMonth.has(k)) continue;
    normalByMonth.set(k, (normalByMonth.get(k) ?? 0) + (a.normalHours ?? 0));
    otByMonth.set(k, (otByMonth.get(k) ?? 0) + (a.otHours ?? 0));
  }
  const monthlyMax = Math.max(1, ...months.map((m) => (normalByMonth.get(m) ?? 0) + (otByMonth.get(m) ?? 0)));

  const hiddenSections = await getHiddenSections(user.id, "timesheets");

  return (
    <div className="space-y-5">
      <PageHeader
        icon={FileSpreadsheet}
        title="Timesheets overview"
        description={`Hours, approvals and attendance for ${period.label.toLowerCase()}. Timesheet rows count whole months.`}
        actions={<><PeriodPicker value={period.key} from={sp.from} to={sp.to} options={PERIOD_OPTIONS} /><CustomizeSections module="timesheets" sections={[{ id: "hours", label: "Hours and approval pipeline" }, { id: "months", label: "Hours, last 6 months" }, { id: "extras", label: "Waiting for approval and attendance" }]} hidden={[...hiddenSections]} /></>}
      />
      <DashboardTabs />

      <KpiStrip
        cells={[
          {
            label: isCurrent ? "This month's rows" : "Timesheet rows",
            value: thisMonthCount,
            sub: "timesheet entries",
            href: "/invoices/client-timesheet",
          },
          {
            label: isCurrent ? "Marked today" : "Marked in the period",
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

      <Sec id="hours" hidden={hiddenSections}>
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
      </Sec>

      <Sec id="months" hidden={hiddenSections}>
      <Panel title="Hours, last 6 months" href="/attendance">
        {months.every((m) => (normalByMonth.get(m) ?? 0) + (otByMonth.get(m) ?? 0) === 0) ? (
          <p className="py-10 text-center text-sm text-muted">
            No hours recorded in the last six months. Mark attendance or import a timesheet to see the monthly trend.
          </p>
        ) : (
        <>
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
                <span className="text-xs text-subtle">{new Date(`${m}-01T00:00:00Z`).toLocaleDateString("en-GB", { month: "short", timeZone: "UTC" })}</span>
              </div>
            );
          })}
        </div>
        </>
        )}
      </Panel>
      </Sec>

      <Sec id="extras" hidden={hiddenSections}>
      <TimesheetsExtras branchId={branchId} />
      </Sec>
    </div>
  );
}
