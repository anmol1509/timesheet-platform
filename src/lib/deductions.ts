// A supplier's rules, set on the supplier (Suppliers → Edit): the first
// `freeDays` absences in a month cost nothing, every one after that costs
// `perDay`. Gas is `perDay` for each day from the worker's check-in date, up to
// `cap` for the month. These defaults apply when no rule is passed.
export type AbsenceRule = { freeDays: number; perDay: number };
export type GasRule = { perDay: number; cap: number };
export const DEFAULT_ABSENCE_RULE: AbsenceRule = { freeDays: 2, perDay: 30 };
export const DEFAULT_GAS_RULE: GasRule = { perDay: 1, cap: 30 };

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
