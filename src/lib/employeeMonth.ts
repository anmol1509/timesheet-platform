import { splitDayHours } from "@/lib/payroll";
import { attendanceCellValue, canonicalMarker, cellsDiffer } from "@/lib/timesheetCells";

/**
 * One worker's month, day by day: what attendance says, what the client's timesheet says, and where they differ.
 * Read-only and free of pay, so it can sit on the employee profile for anyone who may see timesheets. Pure, so the rules are
 * tested without a database.
 */
export type MonthDayInput = { date: string; status: string | null; normalHours: number | null; otHours: number | null; ts: string | null };
export type MonthKind = "work" | "absent" | "leave" | "sick" | "idle" | "off" | "holiday" | "unrecorded" | "outside";
export type MonthDay = {
  date: string;
  weekday: string;
  kind: MonthKind;
  label: string;
  /** Hours worked that day: from attendance, or from the timesheet when attendance has nothing. */
  hours: number;
  /** Of those hours, the overtime and rest-day part. */
  ot: number;
  /** The client timesheet's cell for the day (null when there is no timesheet). */
  ts: string | null;
  /** Whether attendance and the client sheet agree. "unchecked" when there is no attendance or no timesheet to compare. */
  sync: "match" | "differs" | "unchecked";
  hasAttendance: boolean;
};
export type MonthTotals = { workedDays: number; hours: number; ot: number; absent: number; leave: number; sick: number; off: number; unrecorded: number; mismatches: number; sheetHours: number };

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const LABEL: Record<string, string> = { PRESENT: "Present", ABSENT: "Absent", LEAVE: "Leave", SICK_LEAVE: "Sick", IDLE: "Idle", HOLIDAY: "Holiday", OFF: "Off" };
const SHEET_LABEL: Record<string, string> = { absent: "Absent", off: "Off", holiday: "Holiday", leave: "Leave", sick: "Sick", idle: "Idle" };
const round2 = (n: number) => Math.round(n * 100) / 100;

export function buildEmployeeMonth(o: {
  days: MonthDayInput[];
  hasTimesheet: boolean;
  /** First and last day employed this month, YYYY-MM-DD; days outside are shown as "Not employed". */
  from: string;
  to: string;
  weeklyOffDays: number[];
  dailyHours?: number;
}): { rows: MonthDay[]; totals: MonthTotals } {
  const pattern = { dailyHours: o.dailyHours && o.dailyHours > 0 ? o.dailyHours : 8, weeklyOffDays: o.weeklyOffDays };
  const rows: MonthDay[] = o.days.map((d) => {
    const dt = new Date(`${d.date}T00:00:00Z`);
    const base = { date: d.date, weekday: WEEKDAYS[dt.getUTCDay()], ts: d.ts, hasAttendance: d.status !== null };
    if (d.date < o.from || d.date > o.to) return { ...base, kind: "outside" as const, label: "Not employed", hours: 0, ot: 0, sync: "unchecked" as const };
    const wanted = d.status ? attendanceCellValue({ status: d.status, normalHours: d.normalHours, otHours: d.otHours }) : null;
    // Compared only where both sides exist: a day with no attendance record is not a disagreement.
    const sync = !o.hasTimesheet || !d.status ? ("unchecked" as const) : cellsDiffer(wanted, d.ts) ? ("differs" as const) : ("match" as const);

    if (d.status) {
      const split = splitDayHours({ date: dt, status: d.status, normalHours: d.normalHours, otHours: d.otHours }, pattern);
      const hours = round2(split.normal + split.ot + split.rest);
      const kind: MonthKind = d.status === "PRESENT" ? (hours > 0 ? "work" : "unrecorded") : d.status === "ABSENT" ? "absent" : d.status === "LEAVE" ? "leave" : d.status === "SICK_LEAVE" ? "sick" : d.status === "IDLE" ? "idle" : d.status === "HOLIDAY" ? "holiday" : d.status === "OFF" ? "off" : "unrecorded";
      return { ...base, kind, label: kind === "unrecorded" ? "Present, no hours" : LABEL[d.status] ?? d.status, hours, ot: round2(split.ot + split.rest), sync };
    }

    // No attendance for the day: read the client's sheet, or call it a weekly off / no record.
    const n = Number(d.ts);
    if (d.ts && Number.isFinite(n) && n > 0) return { ...base, kind: "work" as const, label: "On client sheet", hours: n, ot: Math.max(0, round2(n - pattern.dailyHours)), sync };
    const marker = canonicalMarker(d.ts);
    const fromSheet: MonthKind | null = marker === "A" ? "absent" : marker === "OFF" ? "off" : marker === "H" ? "holiday" : marker === "L" ? "leave" : marker === "SL" ? "sick" : marker === "I" ? "idle" : null;
    if (fromSheet) return { ...base, kind: fromSheet, label: `${SHEET_LABEL[fromSheet] ?? fromSheet} (client sheet)`, hours: 0, ot: 0, sync };
    const weeklyOff = o.weeklyOffDays.includes(dt.getUTCDay());
    return { ...base, kind: weeklyOff ? ("off" as const) : ("unrecorded" as const), label: weeklyOff ? "Weekly off" : "No record", hours: 0, ot: 0, sync };
  });

  const count = (k: MonthKind) => rows.filter((r) => r.kind === k).length;
  const sheetHours = round2(rows.reduce((s, r) => { const n = Number(r.ts); return s + (r.ts && Number.isFinite(n) && n > 0 ? n : 0); }, 0));
  return {
    rows,
    totals: {
      workedDays: count("work"), hours: round2(rows.reduce((s, r) => s + r.hours, 0)), ot: round2(rows.reduce((s, r) => s + r.ot, 0)),
      absent: count("absent"), leave: count("leave"), sick: count("sick"), off: count("off") + count("holiday"), unrecorded: count("unrecorded"),
      mismatches: rows.filter((r) => r.kind !== "outside" && r.sync === "differs").length, sheetHours,
    },
  };
}
