import { round2 } from "@/lib/payroll";

/** A trade a worker holds, with the hourly rate for it when one is set. */
export type TradeRate = { trade: string; rate: number | null };

const key = (t: string | null | undefined) => (t ?? "").trim().toLowerCase().replace(/\s+/g, " ");

/** The hourly rate for one trade: the rate on the worker's trade of that name, else their usual rate. */
export function rateForTrade(skills: TradeRate[], trade: string | null | undefined, usual: number): { rate: number; fromTrade: boolean } {
  const want = key(trade);
  const hit = want ? skills.find((k) => key(k.trade) === want && (k.rate ?? 0) > 0) : undefined;
  return hit ? { rate: hit.rate ?? 0, fromTrade: true } : { rate: usual, fromTrade: false };
}

export type TradeHours = { trade: string; hours: number };
export type TradePayLine = { trade: string; hours: number; rate: number; pay: number; fromTrade: boolean };

/**
 * Hourly pay when a worker's month is split across trades: every trade's hours are paid at that trade's rate. `blended` is the
 * one rate that gives the same total over all the hours, for the pay calculation that takes a single rate. With one trade (or equal
 * rates) it is exactly that trade's rate, so ordinary workers are unaffected.
 */
export function payByTrade(parts: TradeHours[], skills: TradeRate[], usual: number): { lines: TradePayLine[]; hours: number; pay: number; blended: number; multi: boolean } {
  const merged = new Map<string, TradeHours>();
  for (const p of parts) {
    if (!(p.hours > 0)) continue;
    const k = key(p.trade);
    const cur = merged.get(k);
    if (cur) cur.hours += p.hours;
    else merged.set(k, { trade: p.trade, hours: p.hours });
  }
  const lines = [...merged.values()]
    .sort((a, b) => b.hours - a.hours || a.trade.localeCompare(b.trade))
    .map((m) => {
      const r = rateForTrade(skills, m.trade, usual);
      return { trade: m.trade, hours: round2(m.hours), rate: r.rate, pay: round2(m.hours * r.rate), fromTrade: r.fromTrade };
    });
  const hours = round2(lines.reduce((s, l) => s + l.hours, 0));
  const pay = round2(lines.reduce((s, l) => s + l.pay, 0));
  const rates = new Set(lines.map((l) => l.rate));
  const blended = hours > 0 && rates.size > 1 ? pay / hours : lines[0]?.rate ?? usual;
  return { lines, hours, pay, blended, multi: rates.size > 1 };
}
