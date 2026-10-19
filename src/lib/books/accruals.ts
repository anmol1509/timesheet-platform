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

/** The company's own rules. Anything not set falls back to the UAE labour-law default. */
export type Policy = {
  gratuity: { daysFirst: number; daysAfter: number; firstYears: number; capMonths: number; startAfterMonths: number; basis: "basic" | "fixed" };
  leave: { defaultDays: number | null; capYears: number };
  tickets: { defaultAmount: number | null; defaultEveryMonths: number | null };
};

export const DEFAULT_POLICY: Policy = {
  gratuity: { daysFirst: 21, daysAfter: 30, firstYears: 5, capMonths: 24, startAfterMonths: 0, basis: "basic" },
  leave: { defaultDays: null, capYears: 1 },
  tickets: { defaultAmount: null, defaultEveryMonths: null },
};

const num = (v: unknown, fallback: number, min = 0, max = 1000) => (typeof v === "number" && Number.isFinite(v) && v >= min && v <= max ? v : fallback);
const numOrNull = (v: unknown, min = 0, max = 1_000_000) => (typeof v === "number" && Number.isFinite(v) && v > min && v <= max ? v : null);

/** Reads the stored policy defensively, so a missing or odd value never breaks the books. */
export function readPolicy(raw: unknown): Policy {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, Record<string, unknown> | undefined>;
  const g = r.gratuity ?? {}, l = r.leave ?? {}, t = r.tickets ?? {};
  const d = DEFAULT_POLICY;
  return {
    gratuity: { daysFirst: num(g.daysFirst, d.gratuity.daysFirst, 0, 60), daysAfter: num(g.daysAfter, d.gratuity.daysAfter, 0, 60), firstYears: num(g.firstYears, d.gratuity.firstYears, 0, 50), capMonths: num(g.capMonths, d.gratuity.capMonths, 0, 600), startAfterMonths: num(g.startAfterMonths, d.gratuity.startAfterMonths, 0, 60), basis: g.basis === "fixed" ? "fixed" : "basic" },
    leave: { defaultDays: numOrNull(l.defaultDays, 0, 90), capYears: num(l.capYears, d.leave.capYears, 0.25, 5) },
    tickets: { defaultAmount: numOrNull(t.defaultAmount), defaultEveryMonths: numOrNull(t.defaultEveryMonths, 0, 60) },
  };
}

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
  skipGratuity?: boolean;
};

/**
 * Gratuity earned so far under the company's rules: `daysFirst` days of pay a year for the first `firstYears` years,
 * `daysAfter` after, up to `capMonths` months' pay. Counted from the first day unless the policy says to wait
 * `startAfterMonths` (the legal minimum is one year).
 */
export function gratuityEarned(base: number, years: number, p: Policy["gratuity"] = DEFAULT_POLICY.gratuity): number {
  if (years <= 0 || base <= 0 || years * 12 < p.startAfterMonths) return 0;
  const day = base / 30;
  const raw = Math.min(years, p.firstYears) * p.daysFirst * day + Math.max(0, years - p.firstYears) * p.daysAfter * day;
  return r2(Math.min(raw, base * p.capMonths));
}

/** What each provision should stand at on a date, for one person. A person's own terms beat the company default; 0 means none. */
export function provisionAt(s: StaffFacts, asOf: Date, on: Switches, policy: Policy = DEFAULT_POLICY): Amounts {
  const none: Amounts = { gratuity: 0, leave: 0, tickets: 0 };
  if (!s.joinDate || s.joinDate.getTime() > asOf.getTime()) return none;
  if (s.settledOn && s.settledOn.getTime() <= asOf.getTime()) return none;
  const end = s.exitDate && s.exitDate.getTime() < asOf.getTime() ? s.exitDate : asOf;
  const years = yearsOfService(s.joinDate, end);
  const months = years * 12;
  const leaveDays = s.leaveDaysPerYear ?? policy.leave.defaultDays;
  const ticketAmount = s.ticketAmount ?? policy.tickets.defaultAmount;
  const ticketEvery = s.ticketEveryMonths ?? policy.tickets.defaultEveryMonths;
  return {
    gratuity: on.gratuity && !s.skipGratuity ? gratuityEarned(policy.gratuity.basis === "fixed" ? s.fixed : s.basic, years, policy.gratuity) : 0,
    // Builds up to `capYears` of entitlement, on the assumption that leave is taken or paid out as it falls due.
    leave: on.leave && leaveDays && s.fixed > 0 ? r2((s.fixed / 30) * leaveDays * Math.min(years, policy.leave.capYears)) : 0,
    // Builds across each ticket cycle, then starts again once the ticket is bought.
    tickets: on.tickets && ticketAmount && ticketEvery ? r2(ticketAmount * ((months % ticketEvery) / ticketEvery)) : 0,
  };
}

export function provisionTotals(staff: StaffFacts[], asOf: Date, on: Switches, policy: Policy = DEFAULT_POLICY): Amounts {
  const t: Amounts = { gratuity: 0, leave: 0, tickets: 0 };
  for (const s of staff) {
    const a = provisionAt(s, asOf, on, policy);
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
  policy?: Policy;
  /** What each provision already stood at when the books opened (credit balance). */
  opening: Amounts;
  /** Amounts a paid settlement took out of a provision, by the day it was paid. */
  used: { date: Date; amounts: Partial<Amounts> }[];
  /**
   * When months are locked, their entries can no longer change, so the running balance restarts from what the ledger
   * really holds at the lock date. Later months then make up any difference, instead of working from a past that was
   * never posted.
   */
  lock?: { until: Date; balance: Amounts };
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
    if (i.lock && end.getTime() <= i.lock.until.getTime()) {
      for (const p of PROVISIONS) running[p.key] = i.lock.balance[p.key];
      continue;
    }
    for (const u of i.used) {
      if (i.lock && u.date.getTime() <= i.lock.until.getTime()) continue; // already in the ledger balance

      if (u.date.getTime() >= start.getTime() && u.date.getTime() <= end.getTime()) {
        for (const p of PROVISIONS) running[p.key] = r2(running[p.key] - (u.amounts[p.key] ?? 0));
      }
    }
    const target = provisionTotals(i.staff, end, i.on, i.policy ?? DEFAULT_POLICY);
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
