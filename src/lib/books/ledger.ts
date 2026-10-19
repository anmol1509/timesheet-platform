import { isDebitNormal } from "./chart";

/** Ledger arithmetic — pure, shared by the trial balance, the ledger page and the tests. */
const r2 = (n: number) => Math.round((n + Math.sign(n) * Number.EPSILON) * 100) / 100;

export type AccountTotals = { id: string; code: string; name: string; type: string; debit: number; credit: number };

/** An account's balance, signed so a normal balance is positive (debits for assets and expenses, credits otherwise). */
export function normalBalance(a: { type: string; debit: number; credit: number }): number {
  return r2(isDebitNormal(a.type) ? a.debit - a.credit : a.credit - a.debit);
}

/** The trial balance: each account's net lands in the debit or the credit column. The columns must be equal. */
export function trialBalance(accounts: AccountTotals[]) {
  const rows = accounts
    .map((a) => {
      const net = r2(a.debit - a.credit);
      return { ...a, debitBalance: net > 0 ? net : 0, creditBalance: net < 0 ? -net : 0 };
    })
    .filter((r) => r.debit !== 0 || r.credit !== 0);
  const debit = r2(rows.reduce((s, r) => s + r.debitBalance, 0));
  const credit = r2(rows.reduce((s, r) => s + r.creditBalance, 0));
  return { rows, debit, credit, balanced: debit === credit };
}

export type LedgerLine = { date: Date; number: string; narration: string; debit: number; credit: number };

/** Lines in date order with a running balance (debit-positive), starting from what the account held before the range. */
export function runningBalance(lines: LedgerLine[], opening: number) {
  let bal = r2(opening);
  return lines.map((l) => {
    bal = r2(bal + l.debit - l.credit);
    return { ...l, balance: bal };
  });
}

/** Profit for a set of accounts: income less expenses. */
export function netProfit(accounts: AccountTotals[]): number {
  const income = accounts.filter((a) => a.type === "INCOME").reduce((s, a) => s + (a.credit - a.debit), 0);
  const expense = accounts.filter((a) => a.type === "EXPENSE").reduce((s, a) => s + (a.debit - a.credit), 0);
  return r2(income - expense);
}

/** Whether a date falls on or before the lock date. */
export function isLocked(date: Date, lockedUntil: Date | null): boolean {
  return !!lockedUntil && date.getTime() <= lockedUntil.getTime();
}

/** A bank or cash account: the system ones, any linked to a company bank, or one named like it. */
export const isMoneyAccount = (a: { type: string; tag: string | null; name: string; bankId?: string | null }) =>
  a.type === "ASSET" && (a.tag === "CASH" || a.tag === "BANK" || !!a.bankId || /bank|cash/i.test(a.name));
