import { monthEnd, r2, utcDay, type Posting } from "./postings";

export type AssetFacts = {
  id: string; name: string; cost: number; salvage: number; purchaseDate: Date; lifeMonths: number;
  paidFromAccountId: string | null;
  disposedOn: Date | null; disposalAmount: number | null; disposalAccountId: string | null;
};

const monthIndex = (d: Date) => d.getUTCFullYear() * 12 + d.getUTCMonth();
const ym = (i: number) => `${Math.floor(i / 12)}-${String((i % 12) + 1).padStart(2, "0")}`;

/** Straight-line charge for one month ("YYYY-MM") of an asset's life: full months from the purchase month, the last one takes the rounding. */
export function monthlyCharge(a: AssetFacts, month: string): number {
  const [y, m] = month.split("-").map(Number);
  const idx = y * 12 + (m - 1) - monthIndex(a.purchaseDate);
  if (idx < 0 || idx >= a.lifeMonths) return 0;
  if (a.disposedOn && y * 12 + (m - 1) > monthIndex(a.disposedOn)) return 0;
  const base = Math.max(0, a.cost - a.salvage);
  const each = r2(base / a.lifeMonths);
  return idx === a.lifeMonths - 1 ? r2(base - each * (a.lifeMonths - 1)) : each;
}

/** Total written off from purchase up to and including `month`. */
export function accumulated(a: AssetFacts, month: string): number {
  const [y, m] = month.split("-").map(Number);
  const end = y * 12 + (m - 1);
  let total = 0;
  for (let i = monthIndex(a.purchaseDate); i <= end && i < monthIndex(a.purchaseDate) + a.lifeMonths; i++) total += monthlyCharge(a, ym(i));
  return r2(total);
}

export const bookValue = (a: AssetFacts, month: string) => r2(a.cost - accumulated(a, month));

/**
 * What the register posts: the purchase (when it should be recorded), one depreciation journal a month for finished
 * months, and a disposal entry that takes the asset and its depreciation off the books and shows the gain or loss.
 */
export function assetPostings(assets: AssetFacts[], opening: Date, lastMonth: string): Posting[] {
  const out: Posting[] = [];
  for (const a of assets) {
    if (a.paidFromAccountId && a.purchaseDate.getTime() >= opening.getTime()) {
      out.push({ sourceKey: `asset:${a.id}`, date: utcDay(a.purchaseDate), type: "JOURNAL", narration: `Bought ${a.name}`, lines: [{ tag: "FIXED_ASSETS", debit: r2(a.cost) }, { tag: "BANK", credit: r2(a.cost), accountId: a.paidFromAccountId }] });
    }
    if (a.disposedOn && a.disposedOn.getTime() >= opening.getTime()) {
      const acc = accumulated(a, ym(monthIndex(a.disposedOn)));
      const proceeds = r2(a.disposalAmount ?? 0);
      const gain = r2(proceeds + acc - a.cost);
      out.push({
        sourceKey: `asset-disposal:${a.id}`, date: utcDay(a.disposedOn), type: "JOURNAL", narration: `Sold or scrapped ${a.name}`,
        lines: [
          ...(proceeds > 0 ? [{ tag: "BANK", debit: proceeds, ...(a.disposalAccountId ? { accountId: a.disposalAccountId } : {}) }] : []),
          ...(acc > 0 ? [{ tag: "ACC_DEP", debit: acc }] : []),
          ...(gain < 0 ? [{ tag: "EXPENSE_OTHER", debit: -gain }] : []),
          { tag: "FIXED_ASSETS", credit: r2(a.cost) },
          ...(gain > 0 ? [{ tag: "INCOME_OTHER", credit: gain }] : []),
        ],
      });
    }
  }
  const openIdx = monthIndex(opening);
  const [ly, lm] = lastMonth.split("-").map(Number);
  for (let i = openIdx; i <= ly * 12 + (lm - 1); i++) {
    const m = ym(i);
    const total = r2(assets.reduce((s, a) => s + monthlyCharge(a, m), 0));
    if (total <= 0) continue;
    out.push({ sourceKey: `depreciation:${m}`, date: utcDay(monthEnd(m)), type: "JOURNAL", narration: `Depreciation ${m}`, lines: [{ tag: "EXP_DEPRECIATION", debit: total }, { tag: "ACC_DEP", credit: total }] });
  }
  return out;
}
