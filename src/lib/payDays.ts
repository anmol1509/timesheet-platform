import { round2, splitDayHours } from "@/lib/payroll";
import { attendanceCellValue, cellsDiffer } from "@/lib/timesheetCells";

export type DayInput = { date: string; status: string | null; normalHours: number | null; otHours: number | null; ts: string | null };
export type DayKind = "work" | "absent" | "leave" | "sick" | "idle" | "off" | "holiday" | "unrecorded" | "outside";
export type DaySync = "match" | "differs" | "no-timesheet";
export type DayRow = {
  date: string; weekday: string; kind: DayKind; label: string; hours: number; ot: number; rest: number;
  salary: number; otPay: number; deduction: number; net: number; ts: string | null; sync: DaySync; hasAttendance: boolean;
};

export type DayPlan = {
  /** First and last day employed this month (inclusive), YYYY-MM-DD. */
  from: string; to: string;
  days: DayInput[];
  hasTimesheet: boolean;
  pattern: { dailyHours: number; weeklyOffDays: number[] };
  /** Hourly workers are paid for the hours on the timesheet. */
  hourly: boolean; hourlyRate: number;
  /** Fixed pay for the days employed, as it appears on the run line (basic + allowances). */
  fixedPaid: number;
  paysOvertime: boolean; otMultiplier: number; restMultiplier: number;
  /** basic ÷ 30 ÷ standard hours */
  otHourlyBase: number;
  absence: { freeDays: number; perDay: number | null; dailyRate: number };
};

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const LABEL: Record<string, string> = { PRESENT: "Present", ABSENT: "Absent", LEAVE: "Leave", SICK_LEAVE: "Sick", IDLE: "Idle", HOLIDAY: "Holiday", OFF: "Off" };

/**
 * One row per calendar day: what the person did, what that day paid, and whether the client timesheet says the same.
 * Salary is the run's fixed pay spread over the days employed; overtime and absence use the same rules as the run,
 * so the rows add up to the line (anything else on the line is shown separately by the caller).
 */
export function buildDays(plan: DayPlan): { rows: DayRow[]; totals: { salary: number; otPay: number; deduction: number; net: number; absent: number; ot: number; rest: number; hours: number; mismatches: number; recorded: number } } {
  const employed = plan.days.filter((d) => d.date >= plan.from && d.date <= plan.to);
  const share = !plan.hourly && employed.length > 0 ? plan.fixedPaid / employed.length : 0;
  let spent = 0;
  let absentSeen = 0;
  const rows: DayRow[] = [];
  const lastEmployed = employed[employed.length - 1]?.date;

  for (const d of plan.days) {
    const dt = new Date(`${d.date}T00:00:00Z`);
    const base = { date: d.date, weekday: WEEKDAYS[dt.getUTCDay()], ts: d.ts, hasAttendance: d.status !== null };
    const wanted = d.status ? attendanceCellValue({ status: d.status, normalHours: d.normalHours, otHours: d.otHours }) : null;
    const sync: DaySync = !plan.hasTimesheet ? "no-timesheet" : cellsDiffer(wanted, d.ts) ? "differs" : "match";
    if (d.date < plan.from || d.date > plan.to) {
      rows.push({ ...base, kind: "outside", label: "Not employed", hours: 0, ot: 0, rest: 0, salary: 0, otPay: 0, deduction: 0, net: 0, sync: "no-timesheet" });
      continue;
    }

    if (plan.hourly) {
      const n = Number(d.ts);
      const hours = d.ts && Number.isFinite(n) && n > 0 ? n : 0;
      const salary = round2(hours * plan.hourlyRate);
      const marker = (d.ts ?? "").trim().toUpperCase();
      const kind: DayKind = hours > 0 ? "work" : marker === "A" ? "absent" : marker === "OFF" ? "off" : marker === "H" ? "holiday" : "unrecorded";
      rows.push({ ...base, kind, label: hours > 0 ? "Worked" : kind === "absent" ? "Absent" : kind === "off" ? "Off" : kind === "holiday" ? "Holiday" : "No hours", hours, ot: 0, rest: 0, salary, otPay: 0, deduction: 0, net: salary, sync: d.status ? sync : "no-timesheet" });
      continue;
    }

    const split = splitDayHours({ date: dt, status: d.status ?? "PRESENT", normalHours: d.normalHours, otHours: d.otHours }, plan.pattern);
    const kind: DayKind = !d.status ? (plan.pattern.weeklyOffDays.includes(dt.getUTCDay()) ? "off" : "unrecorded") : d.status === "PRESENT" ? "work" : d.status === "ABSENT" ? "absent" : d.status === "LEAVE" ? "leave" : d.status === "SICK_LEAVE" ? "sick" : d.status === "IDLE" ? "idle" : d.status === "HOLIDAY" ? "holiday" : "off";
    const label = !d.status ? (kind === "off" ? "Weekly off" : "No record") : LABEL[d.status] ?? d.status;
    let salary = round2(share);
    spent = round2(spent + salary);
    if (d.date === lastEmployed) salary = round2(salary + (plan.fixedPaid - spent)); // rounding goes on the last day so the month adds up exactly
    const otPay = plan.paysOvertime ? round2(split.ot * plan.otHourlyBase * plan.otMultiplier + split.rest * plan.otHourlyBase * plan.restMultiplier) : 0;
    let deduction = 0;
    if (kind === "absent") {
      absentSeen += 1;
      deduction = plan.absence.perDay == null ? round2(plan.absence.dailyRate) : absentSeen > plan.absence.freeDays ? round2(plan.absence.perDay) : 0;
    }
    rows.push({ ...base, kind, label, hours: round2(split.normal + split.ot + split.rest), ot: split.ot, rest: split.rest, salary, otPay, deduction, net: round2(salary + otPay - deduction), sync });
  }

  const sum = (f: (r: DayRow) => number) => round2(rows.reduce((s, r) => s + f(r), 0));
  return {
    rows,
    totals: {
      salary: sum((r) => r.salary), otPay: sum((r) => r.otPay), deduction: sum((r) => r.deduction), net: sum((r) => r.net),
      absent: rows.filter((r) => r.kind === "absent").length, ot: sum((r) => r.ot), rest: sum((r) => r.rest), hours: sum((r) => r.hours),
      mismatches: rows.filter((r) => r.kind !== "outside" && r.sync === "differs").length, recorded: rows.filter((r) => r.hasAttendance && r.kind !== "outside").length,
    },
  };
}

/** The attendance a timesheet cell stands for, for copying a timesheet value into attendance. null when the cell says nothing. */
export function attendanceFromCell(value: string | null, dailyHours: number): { status: string; normalHours: number | null; otHours: number | null } | null {
  const v = (value ?? "").trim().toUpperCase();
  if (!v) return null;
  const map: Record<string, string> = { A: "ABSENT", L: "LEAVE", SL: "SICK_LEAVE", I: "IDLE", H: "HOLIDAY", OFF: "OFF" };
  if (map[v]) return { status: map[v], normalHours: null, otHours: null };
  const n = Number(v);
  if (!Number.isFinite(n) || n < 0) return null;
  const limit = dailyHours > 0 ? dailyHours : 8;
  return { status: "PRESENT", normalHours: Math.min(n, limit), otHours: Math.max(0, n - limit) };
}
