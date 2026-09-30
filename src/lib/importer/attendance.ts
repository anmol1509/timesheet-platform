import { randomUUID } from "node:crypto";
import { attendanceCellValue, cellsDiffer } from "@/lib/timesheetCells";
import type { DailyHourCell } from "@/lib/parseTimesheet";
import type { Db } from "./types";

// A timesheet cell is one value per day; attendance keeps a status and hours.
// This is the reverse of attendanceCellValue (which turns attendance into the
// cell), so the two stay in step: whatever is written here reads back as the
// same cell.

type Day = { status: "PRESENT" | "ABSENT" | "LEAVE" | "HOLIDAY" | "OFF"; normalHours: number | null };

/** What a cell means as attendance, or null when it means nothing (blank, zero) or isn't recognised. */
export function cellToAttendance(raw: string): Day | null | "unknown" {
  const v = raw.trim();
  if (!v) return null;
  const n = Number(v);
  if (Number.isFinite(n)) {
    // Hours are stored as normal hours: a sheet gives one total per day and
    // can't say how much of it was overtime.
    return n > 0 ? { status: "PRESENT", normalHours: n } : null;
  }
  switch (v.toUpperCase()) {
    case "A": case "ABS": case "ABSENT": return { status: "ABSENT", normalHours: null };
    case "L": case "LEAVE": case "AL": case "SL": case "SICK": case "SICK LEAVE": case "ANNUAL LEAVE": return { status: "LEAVE", normalHours: null };
    case "H": case "HOL": case "HOLIDAY": case "PH": return { status: "HOLIDAY", normalHours: null };
    case "OFF": case "O": case "WO": case "W/O": return { status: "OFF", normalHours: null };
    default: return "unknown";
  }
}

export type AttendanceStats = {
  attendanceCreated: number;
  /** Days that already had attendance saying something different; left as they were. */
  attendanceConflicts: number;
  attendanceLocked: number;
  attendanceUnrecognised: number;
  unrecognisedValues: Set<string>;
};

export const newAttendanceStats = (): AttendanceStats => ({
  attendanceCreated: 0,
  attendanceConflicts: 0,
  attendanceLocked: 0,
  attendanceUnrecognised: 0,
  unrecognisedValues: new Set(),
});

/**
 * Write one worker's days from their timesheet row into attendance.
 *
 * Only days with nothing recorded yet are created. A day that already has
 * attendance is never overwritten: attendance is what a supervisor marked, and
 * a spreadsheet import must not quietly replace it. Days that disagree are
 * counted so they can be reported.
 */
export async function writeAttendanceFromEntry(
  db: Db,
  args: {
    employeeId: string;
    supplierId: string;
    branchId: string;
    markedById: string;
    /** The project the sheet put this worker on, so the days belong to it. */
    projectId?: string | null;
    days: DailyHourCell[];
  },
  stats: AttendanceStats,
) {
  const wanted: { date: string; day: Day }[] = [];
  for (const cell of args.days) {
    if (!cell.date) continue;
    const day = cellToAttendance(cell.value);
    if (day === null) continue;
    if (day === "unknown") {
      stats.attendanceUnrecognised++;
      if (stats.unrecognisedValues.size < 10) stats.unrecognisedValues.add(cell.value.trim());
      continue;
    }
    wanted.push({ date: cell.date, day });
  }
  if (wanted.length === 0) return;

  const existing = await db.attendance.findMany({
    where: { employeeId: args.employeeId, date: { in: wanted.map((w) => new Date(w.date + "T00:00:00.000Z")) } },
    select: { date: true, status: true, normalHours: true, otHours: true, locked: true },
  });
  const have = new Map(existing.map((a) => [a.date.toISOString().slice(0, 10), a]));

  const create: {
    id: string; date: Date; status: string; normalHours: number | null; otHours: number | null;
    markedById: string; employeeId: string; supplierId: string; branchId: string; projectId: string | null;
  }[] = [];
  for (const { date, day } of wanted) {
    const prior = have.get(date);
    if (prior) {
      if (prior.locked) stats.attendanceLocked++;
      else if (cellsDiffer(attendanceCellValue(prior), attendanceCellValue({ status: day.status, normalHours: day.normalHours, otHours: null }))) stats.attendanceConflicts++;
      continue;
    }
    create.push({
      id: randomUUID(),
      date: new Date(date + "T00:00:00.000Z"),
      status: day.status,
      normalHours: day.normalHours,
      otHours: null,
      markedById: args.markedById,
      employeeId: args.employeeId,
      supplierId: args.supplierId,
      branchId: args.branchId,
      projectId: args.projectId ?? null,
    });
  }
  if (create.length > 0) {
    await db.attendance.createMany({ data: create });
    stats.attendanceCreated += create.length;
  }
}
