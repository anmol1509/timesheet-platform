/**
 * Straight-line depreciation, computed on demand (nothing stored to go stale).
 *
 *   monthly charge = (cost - salvage) / useful life in months
 *   accumulated    = monthly charge x completed months since purchase,
 *                    capped at (cost - salvage)
 *   book value     = cost - accumulated
 *
 * "Completed months" counts from the purchase date: an asset bought 15 Jan has
 * completed its first month on 15 Feb. A disposed asset stops depreciating at
 * its disposal date.
 */
const round2 = (n: number) => Math.round((n + Math.sign(n) * Number.EPSILON) * 100) / 100;

export function completedMonths(from: Date, to: Date): number {
  if (to < from) return 0;
  let m = (to.getUTCFullYear() - from.getUTCFullYear()) * 12 + (to.getUTCMonth() - from.getUTCMonth());
  if (to.getUTCDate() < from.getUTCDate()) m -= 1;
  return Math.max(0, m);
}

export type DepreciationInput = {
  cost: number;
  salvageValue: number;
  usefulLifeMonths: number;
  purchaseDate: Date;
  disposedOn?: Date | null;
};

export function depreciation(a: DepreciationInput, asOf: Date) {
  const depreciable = Math.max(0, a.cost - a.salvageValue);
  const monthly = a.usefulLifeMonths > 0 ? depreciable / a.usefulLifeMonths : 0;
  const end = a.disposedOn && a.disposedOn < asOf ? a.disposedOn : asOf;
  const months = Math.min(completedMonths(a.purchaseDate, end), a.usefulLifeMonths);
  const accumulated = months >= a.usefulLifeMonths ? round2(depreciable) : round2(monthly * months);
  return {
    monthlyCharge: round2(monthly),
    monthsElapsed: months,
    accumulated,
    bookValue: round2(a.cost - accumulated),
    fullyDepreciated: months >= a.usefulLifeMonths,
  };
}

/** Depreciation charged inside one calendar year (for the year-end report). */
export function depreciationForYear(a: DepreciationInput, year: number) {
  const start = new Date(Date.UTC(year - 1, 11, 31));
  const end = new Date(Date.UTC(year, 11, 31));
  return round2(depreciation(a, end).accumulated - depreciation(a, start).accumulated);
}
