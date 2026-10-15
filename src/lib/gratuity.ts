import { round2 } from "@/lib/payroll";

/**
 * UAE end-of-service gratuity (Federal Decree-Law 33 of 2021, Art. 51), for
 * unlimited-term contracts, on the *basic* wage only:
 *  - under 1 year of service: nothing
 *  - first 5 years: 21 days' basic per year
 *  - beyond 5 years: 30 days' basic per year
 *  - part years count pro rata, and the total is capped at 2 years' basic.
 * A day's basic is basic / 30. Resignation-before-3-years reductions and
 * contract-specific terms are deliberately not modelled; this is the accrual
 * figure, not a legal settlement.
 */
export function yearsOfService(join: Date, asOf: Date): number {
  if (asOf.getTime() <= join.getTime()) return 0;
  // Whole calendar years first, so exactly three years of service is 3, not 3.0007; the part year is a fraction of the year it falls in.
  const on = (y: number) => Date.UTC(y, join.getUTCMonth(), join.getUTCDate());
  let years = asOf.getUTCFullYear() - join.getUTCFullYear();
  if (on(join.getUTCFullYear() + years) > asOf.getTime()) years -= 1;
  const from = on(join.getUTCFullYear() + years);
  const to = on(join.getUTCFullYear() + years + 1);
  return years + (asOf.getTime() - from) / (to - from);
}

export function gratuity(basicMonthly: number, years: number): number {
  if (years < 1 || basicMonthly <= 0) return 0;
  const day = basicMonthly / 30;
  const first = Math.min(years, 5);
  const beyond = Math.max(0, years - 5);
  const raw = first * 21 * day + beyond * 30 * day;
  return round2(Math.min(raw, basicMonthly * 24));
}

/** The same calculation as gratuity(), itemised for the public calculator page. */
export function gratuityBreakdown(basicMonthly: number, years: number) {
  const total = gratuity(basicMonthly, years);
  const day = basicMonthly > 0 ? basicMonthly / 30 : 0;
  const eligible = years >= 1 && basicMonthly > 0;
  const firstYears = eligible ? Math.min(years, 5) : 0;
  const beyondYears = eligible ? Math.max(0, years - 5) : 0;
  const cap = round2(basicMonthly * 24);
  const uncapped = round2(firstYears * 21 * day + beyondYears * 30 * day);
  return {
    eligible,
    dailyBasic: round2(day),
    firstYears,
    firstAmount: round2(firstYears * 21 * day),
    beyondYears,
    beyondAmount: round2(beyondYears * 30 * day),
    uncapped,
    cap,
    capApplied: eligible && uncapped > cap,
    total,
  };
}
