/** Matching bank statement lines to ledger entries. Pure, so it can be tested. */
export type StatementItem = { id: string; date: string; description: string; reference?: string | null; amount: number };
export type LedgerItem = { entryId: string; date: string; narration: string; number: string; amount: number };
export type Suggestion = { statementId: string; entryId: string; days: number; confidence: "exact" | "likely" };

const DAY = 86_400_000;
const cents = (n: number) => Math.round(n * 100);
const tokens = (s: string) => new Set(s.toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length >= 4));

/**
 * Pairs each statement line with the ledger entry of the same amount and direction that is closest in date (within
 * `window` days). A shared reference, cheque number or name makes a pair "exact"; amount and date alone is "likely".
 * Each ledger entry is used once.
 */
export function suggestMatches(statement: StatementItem[], ledger: LedgerItem[], window = 7): Suggestion[] {
  type Cand = Suggestion & { score: number };
  const byAmount = new Map<number, LedgerItem[]>();
  for (const l of ledger) byAmount.set(cents(l.amount), [...(byAmount.get(cents(l.amount)) ?? []), l]);
  const cands: Cand[] = [];
  for (const s of statement) {
    const st = tokens(`${s.description} ${s.reference ?? ""}`);
    for (const l of byAmount.get(cents(s.amount)) ?? []) {
      const days = Math.abs(new Date(s.date).getTime() - new Date(l.date).getTime()) / DAY;
      if (days > window) continue;
      const shared = [...tokens(`${l.narration} ${l.number}`)].some((w) => st.has(w));
      cands.push({ statementId: s.id, entryId: l.entryId, days, confidence: shared ? "exact" : "likely", score: (shared ? 0 : 100) + days });
    }
  }
  cands.sort((a, b) => a.score - b.score);
  const usedS = new Set<string>(), usedE = new Set<string>(), out: Suggestion[] = [];
  for (const c of cands) {
    if (usedS.has(c.statementId) || usedE.has(c.entryId)) continue;
    usedS.add(c.statementId); usedE.add(c.entryId);
    out.push({ statementId: c.statementId, entryId: c.entryId, days: c.days, confidence: c.confidence });
  }
  return out;
}
