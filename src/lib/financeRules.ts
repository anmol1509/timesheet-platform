/** Expense and bill rules — pure, so the actions, pages and tests share them. */
const round2 = (n: number) => Math.round((n + Math.sign(n) * Number.EPSILON) * 100) / 100;
const DAY = 86_400_000;

export type BudgetState = "OK" | "NEAR" | "OVER";

/** How a category's approved spend sits against its monthly cap. NEAR from 80%. */
export function budgetStatus(spent: number, limit: number): { pct: number; state: BudgetState; remaining: number } {
  const pct = limit > 0 ? Math.round((spent / limit) * 100) : 0;
  return { pct, state: spent > limit ? "OVER" : pct >= 80 ? "NEAR" : "OK", remaining: round2(limit - spent) };
}

/** Petty-cash float on hand: everything put in, less approved cash expenses. */
export function pettyCashBalance(topUps: number[], approvedCashExpenses: number[]): number {
  const sum = (xs: number[]) => xs.reduce((s, n) => s + n, 0);
  return round2(sum(topUps) - sum(approvedCashExpenses));
}

/** STAFF approvers are capped at the branch limit; admins are not. No limit set = no cap. */
export function exceedsApprovalLimit(total: number, limit: number | null, role: string): boolean {
  if (limit === null || role !== "STAFF") return false;
  return total > limit;
}

type Expenseish = { date: Date; amount: number; vatAmount: number; category: string; paidTo: string | null };

/** The same cost keyed twice: same category and total, same payee, within 3 days. */
export function isDuplicateExpense(a: Expenseish, b: Expenseish): boolean {
  if (a.category !== b.category) return false;
  if (round2(a.amount + a.vatAmount) !== round2(b.amount + b.vatAmount)) return false;
  if ((a.paidTo ?? "").trim().toLowerCase() !== (b.paidTo ?? "").trim().toLowerCase()) return false;
  return Math.abs(a.date.getTime() - b.date.getTime()) <= 3 * DAY;
}

type Billish = { billNo: string; billDate: Date; amount: number; vatAmount: number };

/**
 * A bill that looks like a re-entry of another: same supplier (caller filters),
 * same total, within 45 days, under a different number — the usual way a
 * supplier's resend gets paid twice. The same bill number is caught by the
 * unique key, not here.
 */
export function isDuplicateBill(a: Billish, b: Billish): boolean {
  if (a.billNo.trim().toLowerCase() === b.billNo.trim().toLowerCase()) return false;
  if (round2(a.amount + a.vatAmount) !== round2(b.amount + b.vatAmount)) return false;
  return Math.abs(a.billDate.getTime() - b.billDate.getTime()) <= 45 * DAY;
}

/** How far a bill is from the timesheet value for the month it covers. */
export function billVariance(billTotal: number, timesheetValue: number) {
  const diff = round2(billTotal - timesheetValue);
  const pct = timesheetValue > 0 ? Math.round((diff / timesheetValue) * 100) : null;
  return { diff, pct, state: pct === null ? "NO_REFERENCE" : Math.abs(pct) <= 5 ? "MATCH" : diff > 0 ? "OVER" : "UNDER" } as const;
}
