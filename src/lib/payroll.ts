/**
 * Payroll arithmetic — pure, so the actions, the pages and the tests all use
 * the same rules.
 *
 * Conventions (UAE labour-law practice; change here, not at call sites):
 *  - A pay month is 30 days for absence deductions: daily rate = fixed / 30.
 *  - Overtime is paid on the *basic* wage only (for a FLAT rate, the flat rate
 *    is treated as the basic): hourly = basic / 240 (30 days x 8 hours),
 *    times the employee's multiplier (default 1.25).
 *  - Allowances are fixed monthly amounts and are not used for overtime.
 * All money is rounded to 2 decimals half-away-from-zero at each step.
 */

export const PAY_STRUCTURES = ["ITEMISED", "FLAT"] as const;
export type PayStructure = (typeof PAY_STRUCTURES)[number];

export const PAY_STRUCTURE_LABELS: Record<PayStructure, string> = {
  ITEMISED: "Itemised (basic + allowances)",
  FLAT: "Flat monthly rate",
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
  paysOvertime: boolean;
  otMultiplier: number;
};

export type PayPeriodFacts = {
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
