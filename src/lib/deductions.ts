// Absence: the first `freeDays` absences in a month cost nothing, every one after that costs `perDay`.
//  - On a timesheet it is the CLIENT's rule (Clients → Edit), default 2 free days then AED 25. A sheet with no client uses the default.
//  - In payroll it is the worker's own company's rule (Suppliers → Edit), which payroll reads itself.
// Gas is `perDay` for each day from the worker's check-in date, up to `cap` for the month, and is a timesheet charge only: payroll takes none.
// These defaults apply when no rule is passed.
export type AbsenceRule = { freeDays: number; perDay: number };
export type GasRule = { perDay: number; cap: number };
export const DEFAULT_ABSENCE_RULE: AbsenceRule = { freeDays: 2, perDay: 30 };
export const DEFAULT_GAS_RULE: GasRule = { perDay: 1, cap: 30 };
/** What a timesheet uses when it has no client, or the client has not changed the terms. */
export const DEFAULT_CLIENT_ABSENCE_RULE: AbsenceRule = { freeDays: 2, perDay: 25 };

export function calculateAbsentDeduction(absentCount: number, rule: AbsenceRule = DEFAULT_ABSENCE_RULE): number {
  return Math.max(0, absentCount - rule.freeDays) * rule.perDay;
}

const DAY = 86400000;

/**
 * Gas for the month. With a check-in date it is `perDay` from that date to the
 * end of the month (a date before the month counts the whole month). Without
 * one, it falls back to the days the worker was on the sheet: a blank cell
 * means not on the roster that day, and "A" (absent) means not at camp.
 * Never more than the cap.
 */
export function calculateGasDeduction(
  dailyHours: { value: string }[],
  rule: GasRule = DEFAULT_GAS_RULE,
  opts: { checkIn?: Date | null; month?: string } = {}
): number {
  const m = opts.month ? /^(\d{4})-(\d{2})$/.exec(opts.month) : null;
  if (opts.checkIn && m) {
    const start = Date.UTC(Number(m[1]), Number(m[2]) - 1, 1);
    const days = new Date(Date.UTC(Number(m[1]), Number(m[2]), 0)).getUTCDate();
    const end = start + (days - 1) * DAY;
    const from = Date.UTC(opts.checkIn.getUTCFullYear(), opts.checkIn.getUTCMonth(), opts.checkIn.getUTCDate());
    if (from > end) return 0;
    const n = Math.floor((end - Math.max(from, start)) / DAY) + 1;
    return Math.min(n * rule.perDay, rule.cap);
  }
  const daysAtCamp = dailyHours.filter((d) => d.value !== "" && !/^a$/i.test(d.value)).length;
  return Math.min(daysAtCamp * rule.perDay, rule.cap);
}

export const absenceRuleOf = (s: { absentFreeDays: number; absentDeductionPerDay: { toString(): string } | number }): AbsenceRule => ({
  freeDays: s.absentFreeDays,
  perDay: Number(s.absentDeductionPerDay.toString()),
});
export const gasRuleOf = (s: { gasPerDay: { toString(): string } | number; gasMonthlyCap: { toString(): string } | number }): GasRule => ({
  perDay: Number(s.gasPerDay.toString()),
  cap: Number(s.gasMonthlyCap.toString()),
});

/** A client's absence terms for timesheets; a sheet with no client gets the default. */
export const clientAbsenceRule = (c: { absentFreeDays: number; absentDeductionPerDay: { toString(): string } | number } | null | undefined): AbsenceRule =>
  c ? { freeDays: c.absentFreeDays, perDay: Number(c.absentDeductionPerDay.toString()) } : DEFAULT_CLIENT_ABSENCE_RULE;

/**
 * The absence deduction a timesheet row should start from. Rows saved before clients had their own terms hold what the
 * supplier's rule gave; where the saved figure is exactly that (so nobody changed it by hand) the client's terms apply
 * instead, and anything typed in stays as typed.
 */
export function startingAbsentDeduction(stored: number, absentCount: number, supplierRule: AbsenceRule, clientRule: AbsenceRule): number {
  const old = calculateAbsentDeduction(absentCount, supplierRule);
  return Math.abs(stored - old) < 0.005 ? calculateAbsentDeduction(absentCount, clientRule) : stored;
}
