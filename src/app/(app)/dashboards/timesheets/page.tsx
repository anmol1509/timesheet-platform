import { prisma } from "@/lib/db";
import { PageHeader } from "@/components/PageHeader";
import { StatTile } from "@/components/StatTile";
import { Panel } from "@/components/DashboardPanel";
import { Badge } from "@/components/Badge";
import { requireUserWithBranch } from "@/lib/auth";
import { branchWhere } from "@/lib/branch";
import { FileSpreadsheet, Clock, CheckCircle2, Lock } from "lucide-react";

const STATUS_COLOR: Record<string, "slate" | "amber" | "green" | "red" | "blue"> = {
  DRAFT: "slate",
  SUBMITTED: "blue",
  UNDER_REVIEW: "amber",
  CLIENT_APPROVED: "green",
  REJECTED: "red",
  LOCKED: "slate",
};

function currentMonthKey() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

export default async function TimesheetsDashboardPage() {
  const { branchId } = await requireUserWithBranch();
  const branchScope = branchWhere(branchId);
  const month = currentMonthKey();

  const [thisMonthCount, statusBreakdown, lockedCount, attendanceToday] = await Promise.all([
    prisma.timesheetEntry.count({ where: { ...branchScope, month } }),
    prisma.timesheetEntry.groupBy({ by: ["status"], where: branchScope, _count: { _all: true } }),
    prisma.timesheetEntry.count({ where: { ...branchScope, status: "LOCKED" } }),
    prisma.attendance.count({
      where: { ...branchScope, date: { gte: new Date(new Date().toDateString()) } },
    }),
  ]);

  return (
    <div className="space-y-5">
      <PageHeader title="Timesheets Dashboard" description="This month's timesheet volume and status." />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile href="/invoices/client-timesheet" label="This Month's Rows" value={thisMonthCount} icon={FileSpreadsheet} />
        <StatTile href="/attendance" label="Marked Today" value={attendanceToday} icon={Clock} />
        <StatTile href="/invoices/client-timesheet" label="Locked" value={lockedCount} icon={Lock} />
        <StatTile
          href="/invoices/client-timesheet"
          label="Approved"
          value={statusBreakdown.find((s) => s.status === "CLIENT_APPROVED")?._count._all ?? 0}
          icon={CheckCircle2}
        />
      </div>

      <Panel title="Entries by status">
        <ul className="space-y-1.5">
          {statusBreakdown.map((row) => (
            <li key={row.status} className="flex items-center justify-between text-sm">
              <Badge color={STATUS_COLOR[row.status] ?? "slate"}>{row.status}</Badge>
              <span className="tabular font-semibold text-primary">{row._count._all}</span>
            </li>
          ))}
        </ul>
      </Panel>
    </div>
  );
}
