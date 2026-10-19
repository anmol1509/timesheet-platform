import { yearsOfService } from "@/lib/gratuity";
import { monthEnd, r2, utcDay, type Posting, type PostLine } from "./postings";

/** The three staff provisions the books can accrue, each with the liability it builds and the expense it charges. */
export const PROVISIONS = [
  { key: "gratuity", provision: "EOSB", expense: "EXP_EOSB", label: "End-of-service gratuity" },
  { key: "leave", provision: "PROVISION_LEAVE", expense: "EXP_LEAVE", label: "Annual leave" },
  { key: "tickets", provision: "PROVISION_TICKETS", expense: "EXP_TICKETS", label: "Air tickets" },
] as const;
export type ProvisionKey = (typeof PROVISIONS)[number]["key"];
export type Switches = Record<ProvisionKey, boolean>;
export type Amounts = Record<ProvisionKey, number>;

export type StaffFacts = {
  id: string;
  joinDate: Date | null;
  exitDate: Date | null;
  /** The day their final settlement was paid, once it has been. */
  settledOn: Date | null;
  basic: number;
  /** Basic plus allowances: a day of leave is worth one thirtieth of it. */
  fixed: number;
  leaveDaysPerYear: number | null;
  ticketAmount: number | null;
  ticketEveryMonths: number | null;
};

/**
 * Gratuity earned so far, counted from the first day (the legal minimum is one year, but the cost is earned as the
 * work is done): 21 days' basic a year for the first 5 years, 30 after, capped at two years' basic.
 */
export function gratuityEarned(basicMonthly: number, years: number): number {
  if (years <= 0 || basicMonthly <= 0) return 0;
  const day = basicMonthly / 30;
  return r2(Math.min(Math.min(years, 5) * 21 * day + Math.max(0, years - 5) * 30 * day, basicMonthly * 24));
}

/** What each provision should stand at on a date, for one person. Blank contract terms accrue nothing. */
export function provisionAt(s: StaffFacts, asOf: Date, on: Switches): Amounts {
  const none: Amounts = { gratuity: 0, leave: 0, tickets: 0 };
  if (!s.joinDate || s.joinDate.getTime() > asOf.getTime()) return none;
  if (s.settledOn && s.settledOn.getTime() <= asOf.getTime()) return none;
  const end = s.exitDate && s.exitDate.getTime() < asOf.getTime() ? s.exitDate : asOf;
  const years = yearsOfService(s.joinDate, end);
  const months = years * 12;
  return {
    gratuity: on.gratuity ? gratuityEarned(s.basic, years) : 0,
    // Up to one year's entitlement, on the assumption that leave is taken or paid out each year.
    leave: on.leave && s.leaveDaysPerYear && s.fixed > 0 ? r2((s.fixed / 30) * s.leaveDaysPerYear * Math.min(years, 1)) : 0,
    // Builds across each ticket cycle, then starts again once the ticket is bought.
    tickets: on.tickets && s.ticketAmount && s.ticketEveryMonths ? r2(s.ticketAmount * ((months % s.ticketEveryMonths) / s.ticketEveryMonths)) : 0,
  };
}

export function provisionTotals(staff: StaffFacts[], asOf: Date, on: Switches): Amounts {
  const t: Amounts = { gratuity: 0, leave: 0, tickets: 0 };
  for (const s of staff) {
    const a = provisionAt(s, asOf, on);
    for (const p of PROVISIONS) t[p.key] = r2(t[p.key] + a[p.key]);
  }
  return t;
}

const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** Every month from `from` to `to`, as "YYYY-MM". */
export function monthsBetween(from: string, to: string): string[] {
  const out: string[] = [];
  let [y, m] = from.split("-").map(Number);
  const [ty, tm] = to.split("-").map(Number);
  while (y < ty || (y === ty && m <= tm)) {
    out.push(`${y}-${String(m).padStart(2, "0")}`);
    m += 1;
    if (m > 12) { m = 1; y += 1; }
  }
  return out;
}

export type AccrualInput = {
  months: string[];
  staff: StaffFacts[];
  on: Switches;
  /** What each provision already stood at when the books opened (credit balance). */
  opening: Amounts;
  /** Amounts a paid settlement took out of a provision, by the day it was paid. */
  used: { date: Date; amounts: Partial<Amounts> }[];
};

/**
 * One journal per month that brings each provision up to where it should be. Working from the running balance
 * (rather than last month's target) means settlements paid out of a provision, changes of pay and leavers all
 * correct themselves in the next month's entry.
 */
export function accrualPostings(i: AccrualInput): Posting[] {
  const out: Posting[] = [];
  const running: Amounts = { ...i.opening };
  for (const m of i.months) {
    const end = monthEnd(m);
    const start = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), 1));
    for (const u of i.used) {
      if (u.date.getTime() >= start.getTime() && u.date.getTime() <= end.getTime()) {
        for (const p of PROVISIONS) running[p.key] = r2(running[p.key] - (u.amounts[p.key] ?? 0));
      }
    }
    const target = provisionTotals(i.staff, end, i.on);
    const lines: PostLine[] = [];
    const parts: string[] = [];
    for (const p of PROVISIONS) {
      if (!i.on[p.key]) continue;
      const delta = r2(target[p.key] - running[p.key]);
      running[p.key] = target[p.key];
      if (delta === 0) continue;
      parts.push(p.label.toLowerCase());
      lines.push(delta > 0 ? { tag: p.expense, debit: delta } : { tag: p.expense, credit: -delta });
      lines.push(delta > 0 ? { tag: p.provision, credit: delta } : { tag: p.provision, debit: -delta });
    }
    if (lines.length === 0) continue;
    const [y, mo] = m.split("-").map(Number);
    out.push({ sourceKey: `accrual:${m}`, date: utcDay(end), type: "JOURNAL", narration: `Staff provisions ${MONTH_NAMES[mo - 1]} ${y} — ${parts.join(", ")}`, lines });
  }
  return out;
}
