import { round2 } from "@/lib/payroll";

/** The day salaries are due: the last day of the payroll month plus the branch's grace days. null when no rule is set. */
export function dueDateFor(month: string, dueDays: number | null | undefined): Date | null {
  if (dueDays == null || !Number.isFinite(dueDays) || dueDays < 0) return null;
  const [y, m] = month.split("-").map(Number);
  if (!y || !m) return null;
  return new Date(Date.UTC(y, m, dueDays)); // day 0 of next month is the month's last day
}

export type DueState = { due: Date; overdue: boolean; daysLate: number; daysLeft: number };
export function dueState(due: Date, now = new Date()): DueState {
  const day = 86400000;
  const diff = Math.floor((Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()) - due.getTime()) / day);
  return { due, overdue: diff > 0, daysLate: Math.max(0, diff), daysLeft: Math.max(0, -diff) };
}

/**
 * Arrears for a pay rise that took effect before some months were already paid: the monthly difference times each
 * affected month that is approved or paid. A month counts when it begins on or after the effective date; a rise that
 * starts mid-month is paid from the next full month (the part month is left to the run's own pro-rating).
 */
export function arrearsFor(monthlyIncrease: number, effectiveFrom: Date, closedMonths: string[]): { months: string[]; amount: number } {
  const eff = effectiveFrom.toISOString().slice(0, 10);
  const months = closedMonths.filter((m) => `${m}-01` >= eff).sort();
  return { months, amount: round2(monthlyIncrease * months.length) };
}
