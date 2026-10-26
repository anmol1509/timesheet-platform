/**
 * Payroll arithmetic — pure, so the actions, the pages and the tests all use
 * the same rules.
 *
 * Conventions (UAE labour-law practice; change here, not at call sites):
 *  - A pay month is 30 days for absence deductions: daily rate = fixed / 30.
 *  - Overtime is paid on the *basic* wage only (for a FLAT rate, the flat rate
 *    is treated as the basic): hourly = basic / 30 / the employee's daily hours
 *    (default 8, i.e. basic / 240). Hours beyond the day's standard on a working
 *    day pay at otMultiplier (default 1.25); hours worked on a weekly off day or
 *    holiday use the same multiplier.
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
  dailyHours?: number; // standard hours in a working day (default 8)
  restOtMultiplier?: number; // rest-day / holiday work (default 1.5)
  // The supplier's absence rule: the first absenceFreeDays absences in the month
  // cost nothing, every one after that deducts absencePerDay. Unset = the old
  // rule of one thirtieth of pay per absent day.
  absenceFreeDays?: number;
  absencePerDay?: number;
};

export type PayPeriodFacts = {
  normalHours: number;
  absentDays: number;
  unpaidLeaveDays: number;
  otHours: number; // overtime hours on working days
  restHours?: number; // hours worked on weekly off days / holidays
  // A joiner or leaver is on the payroll for only part of the month: fixed pay is
  // scaled to the days employed. Hourly workers are paid for hours, so it does not apply to them.
  employedDays?: number;
  daysInMonth?: number;
};

export type PayResult = {
  basic: number; // base figure shown on the line (basic or flat rate)
  allowances: number;
  fixed: number; // basic + allowances, before deductions
  deductions: number;
  overtimePay: number;
};

/** What the supplier's absence rule takes off for the absences in the period. */
function absencePenalty(p: PayProfile, f: PayPeriodFacts, fixed = 0) {
  const absent = Math.max(0, f.absentDays);
  if (p.absencePerDay == null) return round2((fixed / 30) * absent);
  return round2(Math.max(0, absent - (p.absenceFreeDays ?? 0)) * p.absencePerDay);
}

/**
 * Gas charge for a month: `perDay` for each day from the check-in date (inclusive)
 * to the end of the month, never more than `cap`. Nothing without a check-in
 * date, after the month, or when waived.
 */
export function gasChargeFor(o: { checkIn: Date | null; monthStart: Date; daysInMonth: number; perDay: number; cap: number; waived: boolean }): number {
  if (o.waived || !o.checkIn || o.perDay <= 0) return 0;
  const monthEnd = Date.UTC(o.monthStart.getUTCFullYear(), o.monthStart.getUTCMonth(), o.daysInMonth);
  const from = Date.UTC(o.checkIn.getUTCFullYear(), o.checkIn.getUTCMonth(), o.checkIn.getUTCDate());
  if (from > monthEnd) return 0;
  const days = Math.min(o.daysInMonth, Math.floor((monthEnd - Math.max(from, o.monthStart.getTime())) / 86400000) + 1);
  return round2(Math.min(Math.max(0, o.cap), days * o.perDay));
}

const dailyHoursOf = (p: { dailyHours?: number }) => (p.dailyHours && p.dailyHours > 0 ? p.dailyHours : 8);

function overtimeAmount(rate: number, p: PayProfile, f: PayPeriodFacts) {
  const rest = p.restOtMultiplier && p.restOtMultiplier > 0 ? p.restOtMultiplier : 1.5;
  return round2(Math.max(0, f.otHours) * rate * p.otMultiplier + Math.max(0, f.restHours ?? 0) * rate * rest);
}

/** How a day's recorded hours split into normal, working-day overtime and rest-day hours. */
export function splitDayHours(
  day: { date: Date; status: string; normalHours: number | null; otHours: number | null },
  pattern: { dailyHours: number; weeklyOffDays: number[] }
): { normal: number; ot: number; rest: number } {
  const total = (day.normalHours ?? 0) + (day.otHours ?? 0);
  if (day.status === "ABSENT" || day.status === "LEAVE" || day.status === "SICK_LEAVE" || day.status === "IDLE" || total <= 0) return { normal: 0, ot: 0, rest: 0 };
  const restDay = day.status === "HOLIDAY" || day.status === "OFF" || pattern.weeklyOffDays.includes(day.date.getUTCDay());
  if (restDay) return { normal: 0, ot: 0, rest: total };
  const limit = pattern.dailyHours > 0 ? pattern.dailyHours : 8;
  return { normal: Math.min(total, limit), ot: Math.max(0, total - limit), rest: 0 };
}

/**
 * Short hours: a present working day with fewer hours than the standard day.
 * The company chooses what it costs: nothing (OFF), the missing hours at the
 * overtime hourly rate (HOURLY), or half a day's pay when the day is under
 * `halfDayUnder` hours (HALF_DAY; a short day above that costs nothing).
 * Only present working days count: absent, leave, sick, idle, holiday, off and
 * weekly-off days never do, and a present day with no hours recorded says nothing.
 */
export const SHORTFALL_MODES = ["OFF", "HOURLY", "HALF_DAY"] as const;
export type ShortfallMode = (typeof SHORTFALL_MODES)[number];
export const SHORTFALL_LABELS: Record<ShortfallMode, string> = { OFF: "Off: no deduction for short days", HOURLY: "Hourly: the missing hours at the hourly rate", HALF_DAY: "Half day: half a day's pay when under a set number of hours" };
export const isShortfallMode = (v: unknown): v is ShortfallMode => v === "OFF" || v === "HOURLY" || v === "HALF_DAY";
export type ShortfallRule = { mode: ShortfallMode; halfDayUnder: number };
export type ShortfallRates = { hourly: number; day: number };

/** Hours worked on a day that counts as short, or null when the day is not a short present working day. */
export function shortDayWorked(
  day: { date: Date; status: string; normalHours: number | null; otHours: number | null },
  pattern: { dailyHours: number; weeklyOffDays: number[] }
): number | null {
  if (day.status !== "PRESENT") return null;
  const split = splitDayHours(day, pattern);
  const limit = pattern.dailyHours > 0 ? pattern.dailyHours : 8;
  const worked = split.normal + split.ot;
  return split.rest === 0 && worked > 0 && worked < limit ? worked : null;
}

/**
 * What one short day costs under the rule. `suggested` is the amount the rule gives;
 * `counted` is whether it is taken (the day's own choice, `override`, wins over the company
 * rule, but nothing is taken while the rule is OFF); `hours` is the time short.
 */
export function shortfallDay(rule: ShortfallRule, standard: number, worked: number, override: boolean | null, rates: ShortfallRates): { hours: number; suggested: number; counted: boolean } {
  const hours = round2(Math.max(0, standard - worked));
  if (rule.mode === "OFF" || hours <= 0) return { hours, suggested: 0, counted: false };
  const suggested = rule.mode === "HALF_DAY" ? (worked < rule.halfDayUnder ? round2(rates.day / 2) : 0) : round2(hours * rates.hourly);
  return { hours, suggested, counted: override !== false && suggested > 0 };
}

/** Total hours short and the deduction for a set of short days, as counted. */
export function shortfallTotal(rule: ShortfallRule, standard: number, days: { worked: number; override: boolean | null }[], rates: ShortfallRates): { hours: number; amount: number } {
  let hours = 0;
  let amount = 0;
  for (const d of days) {
    const r = shortfallDay(rule, standard, d.worked, d.override, rates);
    if (!r.counted) continue;
    hours = round2(hours + r.hours);
    amount = round2(amount + r.suggested);
  }
  return { hours, amount };
}

/**
 * Fixed monthly pay for a month the worker was only on the payroll part of:
 * one thirtieth per day employed, never more than the full month, and the whole
 * amount when they were there for every day of it.
 */
export function proratedFixed(monthly: number, employedDays: number | undefined, daysInMonth: number | undefined): number {
  if (employedDays == null || daysInMonth == null || employedDays >= daysInMonth) return round2(monthly);
  return round2(Math.min(monthly, (monthly / 30) * Math.max(0, employedDays)));
}

export type EmploymentWindow = { from: Date; to: Date; days: number; partial: boolean };

const dayStart = (d: Date) => Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());

/**
 * The days of a month a person is employed: from their join date (or the 1st) to
 * their exit date (or the last day), inclusive. null when they were not employed
 * at all that month, so they are not in its payroll.
 */
export function employmentWindow(month: { start: Date; end: Date; days: number }, joinDate: Date | null, exitDate: Date | null): EmploymentWindow | null {
  const first = Math.max(dayStart(month.start), joinDate ? dayStart(joinDate) : -Infinity);
  const last = Math.min(dayStart(month.end), exitDate ? dayStart(exitDate) : Infinity);
  if (first > last) return null;
  const days = Math.round((last - first) / 86400000) + 1;
  return { from: new Date(first), to: new Date(last), days, partial: days < month.days };
}

export function computePay(p: PayProfile, f: PayPeriodFacts): PayResult {
  if (p.payStructure === "HOURLY") {
    const earned = round2(Math.max(0, f.normalHours) * p.hourly);
    const overtimePay = p.paysOvertime ? overtimeAmount(p.hourly, p, f) : 0;
    // Hourly pay is already only for hours worked; the supplier's absence penalty still applies on top.
    const penalty = Math.min(earned, absencePenalty(p, f));
    return { basic: earned, allowances: 0, fixed: earned, deductions: penalty, overtimePay };
  }
  const basic = p.payStructure === "FLAT" ? p.flat : p.basic;
  const allowances = p.payStructure === "ITEMISED" ? p.housing + p.food + p.transport + p.other : 0;
  const monthlyFixed = round2(basic + allowances);
  // What is earned for the days actually on the payroll this month (the whole month unless a joiner or leaver).
  const fixed = proratedFixed(monthlyFixed, f.employedDays, f.daysInMonth);
  const share = monthlyFixed > 0 ? fixed / monthlyFixed : 1;
  const basicPaid = round2(basic * share);
  const allowancesPaid = round2(fixed - basicPaid);

  // Daily rates stay those of the full month: a partial month is not a cheaper day.
  const unpaidLeave = round2((monthlyFixed / 30) * Math.max(0, f.unpaidLeaveDays));
  const deductions = Math.min(fixed, round2(absencePenalty(p, f, monthlyFixed) + unpaidLeave));

  const hourly = basic / 30 / dailyHoursOf(p);
  const overtimePay = p.paysOvertime ? overtimeAmount(hourly, p, f) : 0;

  return { basic: basicPaid, allowances: allowancesPaid, fixed, deductions, overtimePay };
}

export type PayFigures = {
  payStructure: string | null;
  basicSalary: number; housingAllowance: number; foodAllowance: number; transportAllowance: number; otherAllowance: number;
  flatMonthlyRate: number; hourlyRate: number;
  dailyHours: number; paysOvertime: boolean; otMultiplier: number; restOtMultiplier: number;
};

/** Case- and space-insensitive key for matching a worker's trade to a trade pay row. */
export const tradeKey = (t: string | null | undefined) => (t ?? "").trim().toLowerCase().replace(/\s+/g, " ");

/**
 * The pay figures to use for a worker: the trade's, unless they have their own
 * set (payOverride) or their trade has no pay row.
 */
export function effectivePay(own: PayFigures & { payOverride: boolean }, trade: PayFigures | null): PayFigures & { fromTrade: boolean } {
  if (trade && !own.payOverride) return { ...trade, fromTrade: true };
  return { ...own, fromTrade: false };
}

export const netPay = (r: PayResult, adjustment: number) => round2(r.fixed - r.deductions + r.overtimePay + adjustment);

/** Standing earnings/deductions and loan recovery layered on top of computePay. */
export type PayExtras = { otherEarnings: number; otherDeductions: number; loanDeduction: number; manualDeduction?: number; bankCharge?: number; gasCharge?: number; shortfall?: number };

/**
 * Net pay including recurring items, the advance recovered (loanDeduction) and
 * the deduction typed on the run (manualDeduction).
 */
export const netPayWithExtras = (r: PayResult, adjustment: number, x: PayExtras) =>
  round2(r.fixed - r.deductions + r.overtimePay + adjustment + x.otherEarnings - x.otherDeductions - x.loanDeduction - (x.manualDeduction ?? 0) - (x.bankCharge ?? 0) - (x.gasCharge ?? 0) - (x.shortfall ?? 0));

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
  if (type === "HOURLY") return e.hourlyRate > 0 ? null : "no hourly rate (set a rate on their trade)";
  if (type === "BASIC") {
    if (e.payStructure !== "ITEMISED" && e.payStructure !== "FLAT") return "no monthly pay set up";
    return (e.payStructure === "FLAT" ? e.flatMonthlyRate : e.basicSalary) > 0 ? null : "no basic salary";
  }
  // No company-wide type: each employee is paid by their own pay structure.
  if (!e.payStructure) return "no pay structure";
  if (e.payStructure === "HOURLY") return e.hourlyRate > 0 ? null : "no hourly rate";
  return (e.payStructure === "FLAT" ? e.flatMonthlyRate : e.basicSalary) > 0 ? null : "no basic salary";
}

/** Whether this employee is paid from timesheet hours: the run's type if it has one, else their own pay structure. */
export const paidHourly = (type: CompanyPayType | null, payStructure: string | null) => (type ? type === "HOURLY" : payStructure === "HOURLY");

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

/** One typed deduction on a pay line: what it is for, how much, and whether the payslip lists it by name. */
export type DeductionItem = { label: string; amount: number; show: boolean };

/** Reads the stored list back, dropping anything that isn't a named, positive amount. */
export function readDeductionItems(value: unknown): DeductionItem[] | null {
  if (!Array.isArray(value)) return null;
  const items = value
    .map((v) => (v && typeof v === "object" ? (v as Record<string, unknown>) : null))
    .filter((v): v is Record<string, unknown> => !!v && Number.isFinite(Number(v.amount)) && Number(v.amount) > 0)
    .map((v) => ({ label: String(v.label ?? "").trim().slice(0, 100), amount: round2(Number(v.amount)), show: v.show !== false }));
  return items.length > 0 ? items : null;
}
