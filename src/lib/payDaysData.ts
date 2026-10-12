import { prisma } from "@/lib/db";
import { PAY_EMPLOYEE_SELECT, loadPayOf } from "@/lib/payrollRun";
import { employmentWindow, monthBounds, round2 } from "@/lib/payroll";
import { buildDays, type DayInput, type DayRow } from "@/lib/payDays";
import { parseDailyHours } from "@/lib/timesheetCells";

const num = (v: unknown) => (v == null ? 0 : Number(String(v)));
const iso = (d: Date) => d.toISOString().slice(0, 10);

export type PayDaysView = {
  lineId: string; runId: string; month: string; employee: { id: string; name: string; idNo: string };
  hourly: boolean; editable: boolean; why: string | null; canAlign: boolean;
  hasTimesheet: boolean; timesheetStatus: string | null; dailyHours: number;
  rows: DayRow[];
  totals: { salary: number; otPay: number; deduction: number; net: number; absent: number; ot: number; rest: number; hours: number; mismatches: number; recorded: number };
  other: number; lineNet: number;
};

/** Every day of one employee's pay in a run, with the client timesheet beside it. Scoping to the branch is the caller's job. */
export async function loadPayDays(runId: string, employeeId: string, opts: { canEditAttendance: boolean }): Promise<{ view: PayDaysView; branchId: string } | { error: string }> {
  const line = await prisma.payrollLine.findFirst({ where: { runId, employeeId }, include: { run: true } });
  if (!line) return { error: "Payslip line not found." };
  const bounds = monthBounds(line.run.month);
  if (!bounds) return { error: "Invalid month." };
  const e = await prisma.employee.findUnique({ where: { id: line.employeeId }, select: PAY_EMPLOYEE_SELECT });
  if (!e) return { error: "Employee not found." };
  const window = employmentWindow(bounds, e.joinDate, e.exitDate);
  if (!window) return { error: "This person was not employed in this month." };

  const [att, sheet] = await Promise.all([
    prisma.attendance.findMany({ where: { employeeId: e.id, date: { gte: bounds.start, lte: bounds.end } }, select: { date: true, status: true, normalHours: true, otHours: true } }),
    prisma.timesheetEntry.findMany({ where: { branchId: line.run.branchId, employeeIdNo: e.employeeIdNo, month: line.run.month }, orderBy: { updatedAt: "desc" }, select: { dailyHours: true, status: true, supplierId: true } }),
  ]);
  const entry = sheet.find((s) => s.supplierId === e.supplierId) ?? sheet[0] ?? null;
  const cells = new Map((entry ? parseDailyHours(entry.dailyHours) : []).map((c) => [c.date, c.value]));
  const byDate = new Map(att.map((a) => [iso(a.date), a]));

  const days: DayInput[] = [];
  for (let d = 0; d < bounds.days; d++) {
    const date = iso(new Date(Date.UTC(bounds.start.getUTCFullYear(), bounds.start.getUTCMonth(), d + 1)));
    const a = byDate.get(date);
    days.push({ date, status: a?.status ?? null, normalHours: a?.normalHours ?? null, otHours: a?.otHours ?? null, ts: entry ? (cells.get(date) ?? "") : null });
  }

  const pf = (await loadPayOf(line.run.branchId, [e]))(e);
  const hourly = line.payStructure === "HOURLY";
  const basic = pf.payStructure === "FLAT" ? pf.flatMonthlyRate : pf.basicSalary;
  const monthlyFixed = pf.payStructure === "FLAT" ? pf.flatMonthlyRate : pf.basicSalary + pf.housingAllowance + pf.foodAllowance + pf.transportAllowance + pf.otherAllowance;
  const dailyHours = pf.dailyHours > 0 ? pf.dailyHours : 8;
  const { rows, totals } = buildDays({
    from: iso(window.from), to: iso(window.to), days, hasTimesheet: !!entry,
    pattern: { dailyHours, weeklyOffDays: e.project?.weeklyOffDays ?? [5] },
    hourly, hourlyRate: pf.hourlyRate, fixedPaid: hourly ? 0 : round2(num(line.basic) + num(line.allowances)),
    paysOvertime: hourly ? false : pf.paysOvertime, otMultiplier: pf.otMultiplier, restMultiplier: pf.otMultiplier, otHourlyBase: basic / 30 / dailyHours,
    absence: { freeDays: e.supplier?.absentFreeDays ?? 2, perDay: e.supplier ? num(e.supplier.absentDeductionPerDay) : 30, dailyRate: monthlyFixed / 30 },
  });

  const draft = line.run.status === "DRAFT" && !line.run.submittedAt;
  const why = hourly ? "Hourly pay comes from the timesheet. Change the hours in Timesheets." : !draft ? "This run is no longer a draft, so its days are frozen. Add a correction to next month's payroll instead." : !opts.canEditAttendance ? "You don't have permission to edit attendance." : null;
  return {
    branchId: line.run.branchId,
    view: {
      lineId: line.id, runId: line.runId, month: line.run.month, employee: { id: e.id, name: e.name, idNo: e.employeeIdNo }, hourly, why, editable: why === null, canAlign: why === null && !!entry,
      hasTimesheet: !!entry, timesheetStatus: entry?.status ?? null, dailyHours, rows, totals,
      other: round2(num(line.net) - totals.net), lineNet: num(line.net),
    },
  };
}
