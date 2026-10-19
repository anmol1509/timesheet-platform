import { yearsOfService } from "@/lib/gratuity";
import { monthEnd, r2, utcDay, type Posting, type PostLine } from "./postings";
import type { StaffFacts } from "./accruals";

export type RuleMethod = "PER_PERSON" | "PERCENT" | "COMPANY";
export type CustomRule = { id: string; name: string; method: RuleMethod; amount: number; everyMonths: number; appliesTo: "ALL" | "SITE_STAFF" | "STAFF"; active: boolean };
export type RuleStaff = StaffFacts & { category: string };

export const METHOD_LABEL: Record<RuleMethod, string> = {
  PER_PERSON: "AED per person",
  PERCENT: "% of monthly pay",
  COMPANY: "AED for the whole company",
};

export const provisionTag = (id: string) => `PROV_${id}`;
export const costTag = (id: string) => `EXPC_${id}`;

const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/**
 * What a custom provision should stand at on a date. It builds across a cycle of `everyMonths` months that starts again
 * after each cycle (calendar years for 12 months), so a yearly bonus reaches its full amount in December, then the
 * payment you make clears it.
 */
export function ruleTarget(rule: CustomRule, staff: RuleStaff[], asOf: Date): number {
  if (!rule.active || rule.amount <= 0 || rule.everyMonths <= 0) return 0;
  const inCycle = ((asOf.getUTCFullYear() * 12 + asOf.getUTCMonth()) % rule.everyMonths) + 1;
  if (rule.method === "COMPANY") return r2((rule.amount * inCycle) / rule.everyMonths);
  let total = 0;
  for (const s of staff) {
    if (rule.appliesTo !== "ALL" && s.category !== rule.appliesTo) continue;
    if (!s.joinDate || s.joinDate.getTime() > asOf.getTime()) continue;
    if (s.settledOn && s.settledOn.getTime() <= asOf.getTime()) continue;
    const end = s.exitDate && s.exitDate.getTime() < asOf.getTime() ? s.exitDate : asOf;
    const months = Math.min(inCycle, yearsOfService(s.joinDate, end) * 12);
    if (months <= 0) continue;
    total += rule.method === "PERCENT" ? (s.fixed * rule.amount / 100) * months : (rule.amount * months) / rule.everyMonths;
  }
  return r2(total);
}

export type CustomInput = {
  months: string[];
  staff: RuleStaff[];
  rules: CustomRule[];
  /** What each provision stood at when the books opened (credit balance), by rule id. */
  opening: Record<string, number>;
  /** Net amounts taken out of a provision by entries other than these month-end journals (a payment, a voucher). */
  used: { date: Date; ruleId: string; amount: number }[];
  /** As for the staff provisions: locked months restart the running balance from what the ledger holds at the lock date. */
  lock?: { until: Date; balance: Record<string, number> };
};

/** One journal a month that brings every custom provision up to where it should be, working from the running balance. */
export function customPostings(i: CustomInput): Posting[] {
  const running: Record<string, number> = Object.fromEntries(i.rules.map((r) => [r.id, i.opening[r.id] ?? 0]));
  const out: Posting[] = [];
  for (const m of i.months) {
    const end = monthEnd(m);
    const start = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), 1));
    if (i.lock && end.getTime() <= i.lock.until.getTime()) {
      for (const r of i.rules) running[r.id] = i.lock.balance[r.id] ?? 0;
      continue;
    }
    for (const u of i.used) {
      if (i.lock && u.date.getTime() <= i.lock.until.getTime()) continue;
      if (u.date.getTime() >= start.getTime() && u.date.getTime() <= end.getTime() && u.ruleId in running) running[u.ruleId] = r2(running[u.ruleId] - u.amount);
    }
    const lines: PostLine[] = [];
    const names: string[] = [];
    for (const rule of i.rules) {
      const target = ruleTarget(rule, i.staff, end);
      const delta = r2(target - running[rule.id]);
      running[rule.id] = target;
      if (delta === 0) continue;
      names.push(rule.name);
      lines.push(delta > 0 ? { tag: costTag(rule.id), debit: delta } : { tag: costTag(rule.id), credit: -delta });
      lines.push(delta > 0 ? { tag: provisionTag(rule.id), credit: delta } : { tag: provisionTag(rule.id), debit: -delta });
    }
    if (lines.length === 0) continue;
    const [y, mo] = m.split("-").map(Number);
    out.push({ sourceKey: `accrual-custom:${m}`, date: utcDay(end), type: "JOURNAL", narration: `Provisions ${MONTH_NAMES[mo - 1]} ${y} — ${names.join(", ")}`, lines });
  }
  return out;
}
