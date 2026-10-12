import { prisma } from "@/lib/db";
import { PAY_EMPLOYEE_SELECT, loadPayOf } from "@/lib/payrollRun";
import { employmentWindow, monthBounds, round2 } from "@/lib/payroll";
import { buildDays, type DayInput, type DayRow } from "@/lib/payDays";
import { cellsDiffer, parseDailyHours } from "@/lib/timesheetCells";

const num = (v: unknown) => (v == null ? 0 : Number(String(v)));
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const iso = (d: Date) => d.toISOString().slice(0, 10);

export type PayDaysView = {
  lineId: string; runId: string; month: string; employee: { id: string; name: string; idNo: string };
  hourly: boolean; editable: boolean; why: string | null; canAlign: boolean;
  hasTimesheet: boolean; timesheetStatus: string | null; dailyHours: number;
  rows: DayRow[];
  totals: { salary: number; otPay: number; deduction: number; net: number; absent: number; ot: number; rest: number; hours: number; mismatches: number; recorded: number };
  other: number; lineNet: number;
  /** What the "other items" figure is made of, signed (+ adds to pay, − takes off). */
  /** Timesheet days changed from payroll after the sheet was made, against the first value they had. */
  edits: { date: string; weekday: string; from: string; to: string; by: string; at: string }[];
  /** The typed amounts can be changed here (draft run, payroll edit permission). */
  canAdjust: boolean;
  /** Days where attendance and the client timesheet say different things, for the list at the top. */
  mismatches: { date: string; weekday: string; attendance: string; sheet: string }[];
  parts: { label: string; amount: number; note?: string | null }[];
  /** Part of "other items" that no stored component explains: the line is out of date and needs a recalculation. */
  unexplained: number;
  /** The typed-in amounts for this line, for editing from here. */
  adjust: { lineId: string; deduction: number; deductionNote: string; advance: number; advanceNote: string; adjustment: number; adjustmentNote: string };
};

/** Every day of one employee's pay in a run, with the client timesheet beside it. Scoping to the branch is the caller's job. */
export async function loadPayDays(runId: string, employeeId: string, opts: { canEditAttendance: boolean; canEditPayroll?: boolean }): Promise<{ view: PayDaysView; branchId: string } | { error: string }> {
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
    prisma.timesheetEntry.findMany({ where: { branchId: line.run.branchId, employeeIdNo: e.employeeIdNo, month: line.run.month }, orderBy: { updatedAt: "desc" }, select: { id: true, dailyHours: true, status: true, supplierId: true } }),
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

  // Days changed from payroll (recorded as "day:<date>" changes on the sheet's audit trail), shown against the first value each had.
  const trail = entry ? await prisma.auditLog.findMany({ where: { entityType: "TIMESHEET_ENTRY", entityId: entry.id, action: "UPDATE" }, orderBy: { createdAt: "asc" }, select: { changes: true, userName: true, createdAt: true } }) : [];
  const firstSeen = new Map<string, { from: string; by: string; at: Date }>();
  const lastBy = new Map<string, { by: string; at: Date }>();
  for (const t of trail) {
    for (const [k, c] of Object.entries((t.changes ?? {}) as Record<string, { from?: unknown; to?: unknown }>)) {
      if (!k.startsWith("day:")) continue;
      const date = k.slice(4);
      if (!firstSeen.has(date)) firstSeen.set(date, { from: String(c.from ?? ""), by: t.userName, at: t.createdAt });
      lastBy.set(date, { by: t.userName, at: t.createdAt });
    }
  }
  const edits: PayDaysView["edits"] = [];
  for (const [date, f] of firstSeen) {
    const now = cells.get(date) ?? "";
    if (!cellsDiffer(f.from, now)) continue; // changed back to what it was
    const who = lastBy.get(date) ?? f;
    edits.push({ date, weekday: WEEKDAYS[new Date(`${date}T00:00:00Z`).getUTCDay()], from: f.from || "blank", to: now || "blank", by: who.by, at: who.at.toISOString().slice(0, 10) });
  }
  edits.sort((a, b) => a.date.localeCompare(b.date));

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
  const sheetLocked = hourly && entry?.status === "LOCKED";
  const why = hourly && !entry ? "There is no timesheet for this month, so there are no hours to edit. Add the hours in Timesheets." : sheetLocked ? "This timesheet is locked. Unlock it in Timesheets to change the hours." : !draft ? "This run is no longer a draft, so its days are frozen. Add a correction to next month's payroll instead." : !opts.canEditAttendance ? "You don't have permission to edit attendance." : null;
  const other = round2(num(line.net) - totals.net);
  const items = Array.isArray(line.items) ? (line.items as { kind: string; label: string; amount: number }[]) : [];
  const parts: PayDaysView["parts"] = [];
  if (items.length > 0) for (const i of items) parts.push({ label: i.label, amount: i.kind === "EARNING" ? round2(i.amount) : -round2(i.amount), note: i.kind === "EARNING" ? "Recurring pay" : "Recurring deduction" });
  else {
    if (num(line.otherEarnings) !== 0) parts.push({ label: "Recurring earnings", amount: round2(num(line.otherEarnings)) });
    if (num(line.otherDeductions) !== 0) parts.push({ label: "Recurring deductions", amount: -round2(num(line.otherDeductions)) });
  }
  if (num(line.gasCharge) !== 0) parts.push({ label: "Gas charge", amount: -round2(num(line.gasCharge)), note: e.gasWaived ? "Waived" : null });
  if (num(line.loanDeduction) !== 0) parts.push({ label: "Advance / loan instalment", amount: -round2(num(line.loanDeduction)), note: line.advanceNote });
  if (num(line.manualDeduction) !== 0) parts.push({ label: "Deduction", amount: -round2(num(line.manualDeduction)), note: line.deductionNote });
  if (num(line.adjustment) !== 0) parts.push({ label: "Adjustment", amount: round2(num(line.adjustment)), note: line.adjustmentNote });
  const unexplained = round2(other - parts.reduce((t, x) => t + x.amount, 0));
  return {
    branchId: line.run.branchId,
    view: {
      lineId: line.id, runId: line.runId, month: line.run.month, employee: { id: e.id, name: e.name, idNo: e.employeeIdNo }, hourly, why, editable: why === null, canAlign: why === null && !!entry && !hourly,
      hasTimesheet: !!entry, timesheetStatus: entry?.status ?? null, dailyHours, rows, totals,
      edits,
      mismatches: rows.filter((r) => r.kind !== "outside" && r.sync === "differs").map((r) => ({ date: r.date, weekday: r.weekday, attendance: r.hasAttendance ? `${r.label}${r.hours > 0 ? ` ${r.hours} h` : ""}` : "No record", sheet: r.ts?.trim() ? r.ts : "blank" })),
      other, lineNet: num(line.net), parts, unexplained, canAdjust: draft && (opts.canEditPayroll ?? opts.canEditAttendance),
      adjust: { lineId: line.id, deduction: num(line.manualDeduction), deductionNote: line.deductionNote ?? "", advance: num(line.loanDeduction), advanceNote: line.advanceNote ?? "", adjustment: num(line.adjustment), adjustmentNote: line.adjustmentNote ?? "" },
    },
  };
}
