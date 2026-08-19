import { prisma } from "@/lib/db";
import { branchWhere } from "@/lib/branch";

/**
 * Whether a day's attendance has been done, and how far.
 *
 * The point of the calendar is to answer "which days still need doing" at a
 * glance, so a day that was started but never submitted is deliberately its own
 * state — treating it as done is how a half-filled day reaches payroll.
 */
export type DayState = "submitted" | "draft" | "empty";

export type AttendanceDay = {
  /** YYYY-MM-DD */
  date: string;
  state: DayState;
  marked: number;
  locked: number;
};

/** YYYY-MM-DD in UTC, matching how attendance dates are stored. */
export function isoDate(d: Date) {
  return d.toISOString().slice(0, 10);
}

export function monthRange(month: string) {
  const [year, m] = month.split("-").map(Number);
  const from = new Date(Date.UTC(year, m - 1, 1));
  const to = new Date(Date.UTC(year, m, 1));
  return { from, to, daysInMonth: new Date(Date.UTC(year, m, 0)).getUTCDate() };
}

/**
 * One entry per calendar day of the month, including days with nothing on them
 * — the empty ones are the whole point of the view.
 */
export async function getAttendanceMonth(
  branchId: string | null,
  month: string
): Promise<AttendanceDay[]> {
  const { from, to, daysInMonth } = monthRange(month);

  const rows = await prisma.attendance.findMany({
    where: { ...branchWhere(branchId), date: { gte: from, lt: to } },
    select: { date: true, locked: true },
  });

  const byDate = new Map<string, { marked: number; locked: number }>();
  for (const row of rows) {
    const key = isoDate(row.date);
    const entry = byDate.get(key) ?? { marked: 0, locked: 0 };
    entry.marked += 1;
    if (row.locked) entry.locked += 1;
    byDate.set(key, entry);
  }

  const [year, m] = month.split("-").map(Number);
  return Array.from({ length: daysInMonth }, (_, i) => {
    const date = isoDate(new Date(Date.UTC(year, m - 1, i + 1)));
    const entry = byDate.get(date);
    if (!entry || entry.marked === 0) {
      return { date, state: "empty" as const, marked: 0, locked: 0 };
    }
    // Partly locked still counts as draft: something on that day is unapproved.
    const state: DayState = entry.locked === entry.marked ? "submitted" : "draft";
    return { date, state, marked: entry.marked, locked: entry.locked };
  });
}
