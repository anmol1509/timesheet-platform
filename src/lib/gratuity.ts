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
  const ms = asOf.getTime() - join.getTime();
  return ms > 0 ? ms / (365.25 * 24 * 3600 * 1000) : 0;
}

export function gratuity(basicMonthly: number, years: number): number {
  if (years < 1 || basicMonthly <= 0) return 0;
  const day = basicMonthly / 30;
  const first = Math.min(years, 5);
  const beyond = Math.max(0, years - 5);
  const raw = first * 21 * day + beyond * 30 * day;
  return round2(Math.min(raw, basicMonthly * 24));
}
