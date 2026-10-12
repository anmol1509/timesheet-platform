import { round2 } from "@/lib/payroll";

/**
 * Advances and loans: how a recovery plan is built and read, and the words on the receipt.
 * Pure (no database), so the pay run, the pages and the tests all use the same rules.
 */

export type ScheduleRow = { month: string; amount: number };

const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;

/** The month `n` months after `start` ("YYYY-MM"). */
export function addMonths(start: string, n: number): string {
  const [y, m] = start.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + n, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export type PlanInput =
  | { mode: "ONE_MONTH"; principal: number; month: string }
  | { mode: "EQUAL"; principal: number; startMonth: string; instalment: number }
  | { mode: "CUSTOM"; principal: number; rows: ScheduleRow[] };

/**
 * What to store for a recovery plan: the first month, the instalment, and (for a month-by-month plan) the schedule.
 * An error string when the plan doesn't add up.
 */
export function buildRecoveryPlan(p: PlanInput): { startMonth: string; instalment: number; schedule: ScheduleRow[] | null } | { error: string } {
  if (!(p.principal > 0)) return { error: "Enter the amount advanced." };
  if (p.mode === "ONE_MONTH") {
    if (!MONTH.test(p.month)) return { error: "Choose the month to deduct it in." };
    return { startMonth: p.month, instalment: round2(p.principal), schedule: null };
  }
  if (p.mode === "EQUAL") {
    if (!MONTH.test(p.startMonth)) return { error: "Choose the first month to deduct." };
    if (!(p.instalment > 0) || p.instalment > p.principal) return { error: "The monthly recovery must be above zero and no more than the amount advanced." };
    return { startMonth: p.startMonth, instalment: round2(p.instalment), schedule: null };
  }
  const rows = p.rows.map((r) => ({ month: r.month, amount: round2(r.amount) })).filter((r) => r.amount > 0 || r.month);
  if (rows.length === 0) return { error: "Add at least one month to the plan." };
  if (rows.some((r) => !MONTH.test(r.month))) return { error: "Every row in the plan needs a month." };
  if (rows.some((r) => !(r.amount > 0))) return { error: "Every row in the plan needs an amount above zero." };
  if (new Set(rows.map((r) => r.month)).size !== rows.length) return { error: "A month appears twice in the plan." };
  const sum = round2(rows.reduce((s, r) => s + r.amount, 0));
  if (sum !== round2(p.principal)) return { error: `The plan adds up to AED ${sum.toFixed(2)}, but the amount advanced is AED ${round2(p.principal).toFixed(2)}. They must match.` };
  const sorted = [...rows].sort((a, b) => a.month.localeCompare(b.month));
  return { startMonth: sorted[0].month, instalment: sorted[sorted.length - 1].amount, schedule: sorted };
}

/**
 * What to recover from an advance in a pay month. A fixed advance takes its instalment every month from its first
 * month. A planned one takes that month's amount; once the plan is over, anything still owed keeps coming off at the
 * last planned amount, so a balance is never forgotten.
 */
export function loanInstalmentFor(l: { instalment: number; schedule: ScheduleRow[] | null }, month: string): number {
  if (!l.schedule || l.schedule.length === 0) return l.instalment;
  const exact = l.schedule.find((s) => s.month === month);
  if (exact) return exact.amount;
  const last = l.schedule.reduce((a, b) => (b.month > a.month ? b : a));
  return month > last.month ? last.amount : 0;
}

/** Reads the stored schedule back, ignoring anything that isn't a valid row. */
export function readSchedule(value: unknown): ScheduleRow[] | null {
  if (!Array.isArray(value)) return null;
  const rows = value
    .map((v) => (v && typeof v === "object" ? (v as Record<string, unknown>) : null))
    .filter((v): v is Record<string, unknown> => !!v && typeof v.month === "string" && MONTH.test(v.month) && Number.isFinite(Number(v.amount)))
    .map((v) => ({ month: v.month as string, amount: round2(Number(v.amount)) }));
  return rows.length > 0 ? rows : null;
}

/** The months and amounts a plan will recover, for showing on screen and on the receipt (the last row takes the remainder). */
export function planRows(l: { principal: number; instalment: number; startMonth: string; schedule: ScheduleRow[] | null }): ScheduleRow[] {
  if (l.schedule && l.schedule.length > 0) return l.schedule;
  const out: ScheduleRow[] = [];
  let left = round2(l.principal);
  for (let i = 0; left > 0 && i < 120; i++) {
    const amount = round2(Math.min(l.instalment, left));
    out.push({ month: addMonths(l.startMonth, i), amount });
    left = round2(left - amount);
  }
  return out;
}

const ONES = ["", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen"];
const TENS = ["", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"];

function below1000(n: number): string {
  const parts: string[] = [];
  if (n >= 100) {
    parts.push(`${ONES[Math.floor(n / 100)]} hundred`);
    n %= 100;
  }
  if (n >= 20) {
    parts.push(TENS[Math.floor(n / 10)] + (n % 10 ? `-${ONES[n % 10]}` : ""));
  } else if (n > 0) {
    parts.push(ONES[n]);
  }
  return parts.join(" ");
}

/** An amount in dirhams in words, as a receipt writes it: "one thousand five hundred dirhams and fifty fils only". */
export function amountInWords(amount: number): string {
  const total = Math.round(Math.abs(amount) * 100);
  const dirhams = Math.floor(total / 100);
  const fils = total % 100;
  const groups: [number, string][] = [[1_000_000_000, "billion"], [1_000_000, "million"], [1000, "thousand"]];
  let rest = dirhams;
  const words: string[] = [];
  for (const [size, name] of groups) {
    if (rest >= size) {
      words.push(`${below1000(Math.floor(rest / size))} ${name}`);
      rest %= size;
    }
  }
  if (rest > 0 || words.length === 0) words.push(rest > 0 ? below1000(rest) : "zero");
  const d = `${words.join(" ")} dirham${dirhams === 1 ? "" : "s"}`;
  const text = fils > 0 ? `${d} and ${below1000(fils)} fils` : d;
  return `${text} only`.replace(/^./, (c) => c.toUpperCase());
}

export const ADVANCE_METHODS = [["CASH", "Cash"], ["BANK", "Bank transfer"], ["OTHER", "Other"]] as const;
export const methodLabel = (m: string | null | undefined) => ADVANCE_METHODS.find(([v]) => v === m)?.[1] ?? "—";

/** "ADV-0007" */
export const advanceRef = (refNo: number) => `ADV-${String(refNo).padStart(4, "0")}`;

/** Where an advance stands, in words. */
export function advanceState(l: { approvalStatus: string; status: string; givenDate: Date | null; principal: number; repaid: number }): { key: "PENDING" | "REJECTED" | "TO_GIVE" | "RECOVERING" | "CLEARED" | "CANCELLED"; label: string } {
  if (l.approvalStatus === "REJECTED") return { key: "REJECTED", label: "Rejected" };
  if (l.status === "CANCELLED") return { key: "CANCELLED", label: "Cancelled" };
  if (l.approvalStatus === "PENDING") return { key: "PENDING", label: "Awaiting approval" };
  if (!l.givenDate) return { key: "TO_GIVE", label: "Approved, not yet given" };
  if (l.status === "CLEARED" || l.repaid >= l.principal) return { key: "CLEARED", label: "Cleared" };
  return { key: "RECOVERING", label: "Recovering" };
}
