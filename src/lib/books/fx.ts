import { monthEnd, r2, utcDay, type Posting } from "./postings";

export type RatePoint = { date: Date; rate: number };
export type FxAccount = {
  accountId: string; currency: string;
  /** Every non-revaluation movement: the AED value (debit minus credit) and the foreign amount (same sign). */
  movements: { date: Date; aed: number; foreign: number }[];
};

/** The rate in force on a date: the latest one on or before it. */
export function rateOn(rates: RatePoint[], date: Date): number | null {
  let best: RatePoint | null = null;
  for (const r of rates) if (r.date.getTime() <= date.getTime() && (!best || r.date.getTime() > best.date.getTime())) best = r;
  return best ? best.rate : null;
}

/** AED worth of a foreign amount at a rate, to the fils. */
export const toAed = (foreign: number, rate: number) => r2(foreign * rate);

/**
 * Month-end revaluation of foreign-currency bank balances: each account is brought to what its foreign balance is worth
 * in AED at the month-end rate, with the difference taken to exchange gain or loss. A month with no rate yet is skipped.
 */
export function fxPostings(accounts: FxAccount[], rates: Record<string, RatePoint[]>, months: string[]): Posting[] {
  const out: Posting[] = [];
  const adjusted = new Map<string, number>();
  for (const m of months) {
    const end = monthEnd(m);
    const lines: Posting["lines"] = [];
    for (const a of accounts) {
      const rate = rateOn(rates[a.currency] ?? [], end);
      if (rate === null) continue;
      const upTo = a.movements.filter((x) => x.date.getTime() <= end.getTime());
      const foreignBalance = r2(upTo.reduce((s, x) => s + x.foreign, 0));
      const book = r2(upTo.reduce((s, x) => s + x.aed, 0) + (adjusted.get(a.accountId) ?? 0));
      const delta = r2(toAed(foreignBalance, rate) - book);
      if (delta === 0) continue;
      adjusted.set(a.accountId, r2((adjusted.get(a.accountId) ?? 0) + delta));
      lines.push(delta > 0 ? { tag: "BANK", debit: delta, accountId: a.accountId } : { tag: "BANK", credit: -delta, accountId: a.accountId });
      lines.push(delta > 0 ? { tag: "EXP_FX", credit: delta } : { tag: "EXP_FX", debit: -delta });
    }
    if (lines.length === 0) continue;
    out.push({ sourceKey: `fx:${m}`, date: utcDay(end), type: "JOURNAL", narration: `Revalue foreign currency accounts ${m}`, lines });
  }
  return out;
}
