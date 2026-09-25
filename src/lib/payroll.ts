/**
 * Payroll arithmetic — pure, so the actions, the pages and the tests all use
 * the same rules.
 *
 * Conventions (UAE labour-law practice; change here, not at call sites):
 *  - A pay month is 30 days for absence deductions: daily rate = fixed / 30.
 *  - Overtime is paid on the *basic* wage only (for a FLAT rate, the flat rate
 *    is treated as the basic): hourly = basic / 240 (30 days x 8 hours),
 *    times the employee's multiplier (default 1.25).
 *  - HOURLY workers are paid normal hours x hourly rate (so there is nothing to
 *    deduct for absence), and overtime at hourly rate x multiplier.
 *  - Allowances are fixed monthly amounts and are not used for overtime.
 * All money is rounded to 2 decimals half-away-from-zero at each step.
 */

export const PAY_STRUCTURES = ["ITEMISED", "FLAT", "HOURLY"] as const;
export type PayStructure = (typeof PAY_STRUCTURES)[number];

export const PAY_STRUCTURE_LABELS: Record<PayStructure, string> = {
  ITEMISED: "Itemised (basic + allowances)",
  FLAT: "Flat monthly rate",
  HOURLY: "Hourly rate",
};

export const round2 = (n: number) => Math.round((n + Math.sign(n) * Number.EPSILON) * 100) / 100;

export type PayProfile = {
  payStructure: PayStructure;
  basic: number; // basic (ITEMISED) — ignored for FLAT
  housing: number;
  food: number;
  transport: number;
  other: number;
  flat: number; // FLAT monthly rate — ignored for ITEMISED
  hourly: number; // HOURLY rate per normal hour
  paysOvertime: boolean;
  otMultiplier: number;
};

export type PayPeriodFacts = {
  normalHours: number;
  absentDays: number;
  unpaidLeaveDays: number;
  otHours: number;
};

export type PayResult = {
  basic: number; // base figure shown on the line (basic or flat rate)
  allowances: number;
  fixed: number; // basic + allowances, before deductions
  deductions: number;
  overtimePay: number;
};

export function computePay(p: PayProfile, f: PayPeriodFacts): PayResult {
  if (p.payStructure === "HOURLY") {
    const earned = round2(Math.max(0, f.normalHours) * p.hourly);
    const overtimePay = p.paysOvertime ? round2(Math.max(0, f.otHours) * p.hourly * p.otMultiplier) : 0;
    return { basic: earned, allowances: 0, fixed: earned, deductions: 0, overtimePay };
  }
  const basic = p.payStructure === "FLAT" ? p.flat : p.basic;
  const allowances = p.payStructure === "ITEMISED" ? p.housing + p.food + p.transport + p.other : 0;
  const fixed = round2(basic + allowances);

  const unpaidDays = Math.max(0, f.absentDays) + Math.max(0, f.unpaidLeaveDays);
  const deductions = Math.min(fixed, round2((fixed / 30) * unpaidDays));

  const hourly = basic / 240;
  const overtimePay = p.paysOvertime ? round2(Math.max(0, f.otHours) * hourly * p.otMultiplier) : 0;

  return { basic: round2(basic), allowances: round2(allowances), fixed, deductions, overtimePay };
}

export const netPay = (r: PayResult, adjustment: number) => round2(r.fixed - r.deductions + r.overtimePay + adjustment);

/** Standing earnings/deductions and loan recovery layered on top of computePay. */
export type PayExtras = { otherEarnings: number; otherDeductions: number; loanDeduction: number; manualDeduction?: number };

/**
 * Net pay including recurring items, the advance recovered (loanDeduction) and
 * the deduction typed on the run (manualDeduction).
 */
export const netPayWithExtras = (r: PayResult, adjustment: number, x: PayExtras) =>
  round2(r.fixed - r.deductions + r.overtimePay + adjustment + x.otherEarnings - x.otherDeductions - x.loanDeduction - (x.manualDeduction ?? 0));

/** How a company pays everyone in it. */
export const PAY_TYPES = ["BASIC", "HOURLY"] as const;
export type CompanyPayType = (typeof PAY_TYPES)[number];
export const PAY_TYPE_LABELS: Record<CompanyPayType, string> = { BASIC: "Basic (monthly salary, from attendance)", HOURLY: "Hourly (hours from the timesheet)" };
export const isPayType = (v: string | null | undefined): v is CompanyPayType => v === "BASIC" || v === "HOURLY";

/**
 * Whether an employee has what their company's pay type needs, and if not, why
 * they can't be paid. BASIC needs a monthly figure; HOURLY needs an hourly rate.
 * A run with no pay type (created before companies had one) keeps the old rule:
 * any pay structure will do.
 */
export function payDataGap(
  type: CompanyPayType | null,
  e: { payStructure: string | null; basicSalary: number; flatMonthlyRate: number; hourlyRate: number }
): string | null {
  if (type === "HOURLY") return e.hourlyRate > 0 ? null : "no hourly rate";
  if (type === "BASIC") {
    if (e.payStructure !== "ITEMISED" && e.payStructure !== "FLAT") return "no monthly pay set up";
    return (e.payStructure === "FLAT" ? e.flatMonthlyRate : e.basicSalary) > 0 ? null : "no basic salary";
  }
  return e.payStructure ? null : "no pay structure";
}

/** Splits an amount typed against what is available, so a deduction can never push net pay below zero. */
export const capToAvailable = (wanted: number, available: number) => round2(Math.max(0, Math.min(wanted, available)));

/**
 * Loan instalments recovered this run. Each loan takes its instalment (or what
 * is left of it), in the order given, but never more than keeps net pay at zero
 * — recovery must not push someone below nothing. Returns the amount taken per
 * loan, so the run can record each repayment.
 */
export function planLoanRecovery(
  loans: { id: string; remaining: number; instalment: number }[],
  availableToRecover: number
): { loanId: string; amount: number }[] {
  let room = Math.max(0, round2(availableToRecover));
  const out: { loanId: string; amount: number }[] = [];
  for (const l of loans) {
    if (room <= 0) break;
    const amount = round2(Math.min(l.instalment, l.remaining, room));
    if (amount <= 0) continue;
    out.push({ loanId: l.id, amount });
    room = round2(room - amount);
  }
  return out;
}

/** Whether a standing item applies to a pay month ("YYYY-MM" compares correctly as text). */
export const appliesToMonth = (a: { startMonth: string; endMonth: string | null }, month: string) =>
  a.startMonth <= month && (a.endMonth == null || month <= a.endMonth);

/** What's missing for a worker to be paid through WPS, in plain words. */
export function wpsGaps(l: {
  paymentMode: string | null;
  personCode: string | null;
  routingCode: string | null;
  account: string | null;
}): string[] {
  if (isCashMode(l.paymentMode)) return [];
  const gaps: string[] = [];
  if (!l.personCode) gaps.push("MOL person code");
  if (!l.routingCode || !/^\d{9}$/.test(l.routingCode.trim())) gaps.push("9-digit bank routing code");
  if (!l.account) gaps.push("IBAN / account number");
  return gaps;
}

export function isCashMode(mode: string | null | undefined) {
  return !!mode && /cash/i.test(mode);
}

export function monthBounds(month: string): { start: Date; end: Date; days: number } | null {
  const m = /^(\d{4})-(\d{2})$/.exec(month);
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  if (mo < 1 || mo > 12) return null;
  const start = new Date(Date.UTC(y, mo - 1, 1));
  const end = new Date(Date.UTC(y, mo, 0));
  return { start, end, days: end.getUTCDate() };
}
