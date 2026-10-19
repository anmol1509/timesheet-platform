import { r2 } from "./postings";

export type CloseAccount = { id: string; type: string; debit: number; credit: number };
export type CloseLine = { accountId: string; debit: number; credit: number };

/**
 * The year-end closing entry: every income and expense account is brought back to zero and the year's profit (or loss)
 * moves to retained earnings. Returns no lines when nothing was earned or spent.
 */
export function closingLines(accounts: CloseAccount[], retainedEarningsId: string): { lines: CloseLine[]; profit: number } {
  const lines: CloseLine[] = [];
  let profit = 0;
  for (const a of accounts) {
    if (a.type === "INCOME") {
      const net = r2(a.credit - a.debit);
      if (net === 0) continue;
      profit += net;
      lines.push(net > 0 ? { accountId: a.id, debit: net, credit: 0 } : { accountId: a.id, debit: 0, credit: -net });
    } else if (a.type === "EXPENSE") {
      const net = r2(a.debit - a.credit);
      if (net === 0) continue;
      profit -= net;
      lines.push(net > 0 ? { accountId: a.id, debit: 0, credit: net } : { accountId: a.id, debit: -net, credit: 0 });
    }
  }
  profit = r2(profit);
  if (lines.length === 0) return { lines, profit: 0 };
  if (profit !== 0) lines.push(profit > 0 ? { accountId: retainedEarningsId, debit: 0, credit: profit } : { accountId: retainedEarningsId, debit: -profit, credit: 0 });
  return { lines, profit };
}
