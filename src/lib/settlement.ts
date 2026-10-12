import { gratuity, yearsOfService } from "@/lib/gratuity";
import { round2 } from "@/lib/payroll";

/**
 * A leaver's final settlement: what they are owed or owe on the last day.
 *
 *   gratuity (on basic, see gratuity.ts) + pay for days worked that no payroll run covers
 *   + leave pay + notice pay + anything else owed
 *   - loans and advances still outstanding - anything else they owe.
 *
 * It can come out negative (the employee owes the company); that is shown, not hidden.
 * Leave and notice pay are typed in: leave balances are not tracked here yet.
 */
export type SettlementInput = {
  basicMonthly: number;
  fixedMonthly: number; // basic + allowances, the monthly figure a day is worth one thirtieth of
  joinDate: Date | null;
  exitDate: Date;
  unpaidSalaryDays: number;
  leavePay: number;
  noticePay: number;
  otherEarnings: number;
  loanBalance: number;
  otherDeductions: number;
};

export type SettlementResult = {
  serviceYears: number;
  gratuity: number;
  unpaidSalary: number;
  earnings: number;
  deductions: number;
  net: number;
};

const money = (n: number) => (Number.isFinite(n) && n > 0 ? round2(n) : 0);

export function computeSettlement(i: SettlementInput): SettlementResult {
  const serviceYears = i.joinDate ? yearsOfService(i.joinDate, i.exitDate) : 0;
  const grat = gratuity(i.basicMonthly, serviceYears);
  const unpaidSalary = round2((Math.max(0, i.fixedMonthly) / 30) * Math.max(0, Math.min(31, i.unpaidSalaryDays)));
  const earnings = round2(grat + unpaidSalary + money(i.leavePay) + money(i.noticePay) + money(i.otherEarnings));
  const deductions = round2(money(i.loanBalance) + money(i.otherDeductions));
  return { serviceYears: Math.round(serviceYears * 100) / 100, gratuity: grat, unpaidSalary, earnings, deductions, net: round2(earnings - deductions) };
}

/**
 * Days of the exit month the employee worked that the payroll run for that month
 * does not pay. Zero when a run covers them (it pays up to the last working day);
 * otherwise every day up to and including the exit date, counted on a 30-day month.
 */
export function unpaidDaysDefault(exitDate: Date, coveredByRun: boolean): number {
  if (coveredByRun) return 0;
  return Math.min(30, exitDate.getUTCDate());
}
