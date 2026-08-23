import type { DailyHourCell } from "@/lib/parseTimesheet";

/**
 * The month grid a client timesheet is made of, and the rules for reading and
 * writing one cell of it.
 *
 * `TimesheetEntry.dailyHours` is a JSON array of one cell per day, and until
 * now every screen that touched it rebuilt the grid, re-derived the totals and
 * re-decided what a value means. Attendance now writes into the same grid, so
 * those rules live here rather than being restated a third time.
 */

export const WEEKDAY_ABBR = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/**
 * The stored `monthLabel` format, e.g. "MAY-25".
 *
 * Deliberately not the `monthLabelFromKey` in `timesheetSummary.ts`, which
 * renders "May 2025" for display. The names are similar and the outputs are
 * not; this is the one written to the column.
 */
export function storedMonthLabel(month: string) {
  const [y, m] = month.split("-");
  const date = new Date(Number(y), Number(m) - 1, 1);
  return date
    .toLocaleDateString("en-US", { month: "short", year: "2-digit" })
    .replace(" ", "-")
    .toUpperCase();
}

/** A blank cell per day of the month, in order. */
export function buildMonthCells(month: string): DailyHourCell[] {
  const [year, monthNum] = month.split("-").map(Number);
  const daysInMonth = new Date(year, monthNum, 0).getDate();
  const cells: DailyHourCell[] = [];
  for (let d = 1; d <= daysInMonth; d++) {
    const cellDate = new Date(Date.UTC(year, monthNum - 1, d));
    const iso = cellDate.toISOString().slice(0, 10);
    cells.push({ date: iso, label: WEEKDAY_ABBR[cellDate.getUTCDay()], value: "" });
  }
  return cells;
}

/** Only numeric cells are hours; "A" is the absence marker. */
export function recompute(days: DailyHourCell[]) {
  let totalHours = 0;
  let absentCount = 0;
  for (const d of days) {
    const n = Number(d.value);
    if (d.value && Number.isFinite(n)) totalHours += n;
    else if (d.value.trim().toUpperCase() === "A") absentCount++;
  }
  return { totalHours, absentCount };
}

export function readCell(days: DailyHourCell[], date: string): string | null {
  const cell = days.find((d) => d.date === date);
  return cell ? cell.value : null;
}

export function writeCell(
  days: DailyHourCell[],
  date: string,
  value: string
): DailyHourCell[] {
  return days.map((d) => (d.date === date ? { ...d, value } : d));
}

export function parseDailyHours(json: string): DailyHourCell[] {
  try {
    const parsed = JSON.parse(json);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/**
 * Statuses a sync may still write to.
 *
 * Once a sheet has gone to the client, the number they were shown is the
 * record of what was claimed. Attendance corrected afterwards must be visible
 * as a disagreement rather than quietly replacing it — otherwise the sheet and
 * the conversation about the sheet stop matching.
 */
export const OPEN_TIMESHEET_STATUSES = ["DRAFT", "REJECTED"] as const;

export function isTimesheetOpen(status: string) {
  return (OPEN_TIMESHEET_STATUSES as readonly string[]).includes(status);
}

/**
 * The cell a day's attendance implies, or null when it implies nothing.
 *
 * A client timesheet carries one number per day, so normal and overtime hours
 * are added — that is the time the worker was on the client's site. Present
 * with no hours recorded returns null rather than zero: nobody meant to claim
 * a zero-hour day, and blanking a cell that someone filled in by hand would be
 * a silent deletion.
 */
export function attendanceCellValue(a: {
  status: string;
  normalHours: number | null;
  otHours: number | null;
}): string | null {
  switch (a.status) {
    case "ABSENT":
      return "A";
    case "LEAVE":
      return "L";
    case "HOLIDAY":
      return "H";
    case "OFF":
      return "OFF";
    case "PRESENT": {
      const total = (a.normalHours ?? 0) + (a.otHours ?? 0);
      return total > 0 ? String(total) : null;
    }
    default:
      return null;
  }
}

/**
 * Whether two cell values disagree.
 *
 * Compared as numbers when both are numeric, so "10" and "10.0" are the same
 * claim written two ways; otherwise case- and space-insensitively.
 */
export function cellsDiffer(a: string | null, b: string | null): boolean {
  const na = Number(a);
  const nb = Number(b);
  const aNum = a !== null && a.trim() !== "" && Number.isFinite(na);
  const bNum = b !== null && b.trim() !== "" && Number.isFinite(nb);
  if (aNum && bNum) return na !== nb;
  return (a ?? "").trim().toUpperCase() !== (b ?? "").trim().toUpperCase();
}
