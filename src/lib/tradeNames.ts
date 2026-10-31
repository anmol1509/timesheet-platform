import { TRADES } from "@/lib/trades";

/**
 * The trades to offer in a dropdown: the built-in list first, in its usual order, then any others the company has added on the
 * Trades page, A to Z. Names that differ only by case or spacing count as one, and the built-in spelling wins.
 */
export function mergeTradeNames(added: readonly string[]): string[] {
  const key = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");
  const seen = new Set<string>(TRADES.map(key));
  const extra: string[] = [];
  for (const raw of added) {
    const name = raw.trim().replace(/\s+/g, " ");
    if (!name || seen.has(key(name))) continue;
    seen.add(key(name));
    extra.push(name);
  }
  extra.sort((a, b) => a.localeCompare(b));
  return [...TRADES, ...extra];
}
