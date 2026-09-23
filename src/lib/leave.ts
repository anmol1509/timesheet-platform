/** Pure leave helpers — shared by the actions and the pages. Dates are UTC midnights. */

const DAY = 86_400_000;

export function parseDay(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const d = new Date(`${value}T00:00:00.000Z`);
  return isNaN(d.getTime()) ? null : d;
}

/** Inclusive calendar-day count of start..end. */
export function inclusiveDays(start: Date, end: Date): number {
  return Math.round((end.getTime() - start.getTime()) / DAY) + 1;
}

/** How many of a request's days fall inside a calendar year (a request can straddle New Year). */
export function daysInYear(start: Date, end: Date, year: number): number {
  const ys = Date.UTC(year, 0, 1);
  const ye = Date.UTC(year, 11, 31);
  const s = Math.max(start.getTime(), ys);
  const e = Math.min(end.getTime(), ye);
  return e < s ? 0 : Math.round((e - s) / DAY) + 1;
}

export const LEAVE_STATUS_LABELS: Record<string, string> = {
  PENDING: "Pending",
  APPROVED: "Approved",
  REJECTED: "Rejected",
  CANCELLED: "Cancelled",
};

/** UAE Labour Law starting points (Federal Decree-Law 33 of 2021). Editable
 * per branch afterwards — these only save typing on first setup. */
export const UAE_DEFAULT_LEAVE_TYPES: { code: string; name: string; paid: boolean; daysPerYear: number }[] = [
  { code: "ANNUAL", name: "Annual leave", paid: true, daysPerYear: 30 },
  { code: "SICK", name: "Sick leave", paid: true, daysPerYear: 90 },
  { code: "UNPAID", name: "Unpaid leave", paid: false, daysPerYear: 0 },
  { code: "MATERNITY", name: "Maternity leave", paid: true, daysPerYear: 60 },
  { code: "COMPASSIONATE", name: "Compassionate leave", paid: true, daysPerYear: 5 },
  { code: "HAJJ", name: "Hajj leave", paid: false, daysPerYear: 30 },
];
