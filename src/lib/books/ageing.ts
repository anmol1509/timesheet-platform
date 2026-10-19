import { r2 } from "./postings";

export const BUCKETS = ["current", "d30", "d60", "d90", "over"] as const;
export type Bucket = (typeof BUCKETS)[number];
export const BUCKET_LABEL: Record<Bucket, string> = { current: "Not yet due", d30: "1–30 days", d60: "31–60 days", d90: "61–90 days", over: "Over 90 days" };

export type AgeLine = { date: Date; debit: number; credit: number; partyId: string | null };
export type AgeRow = { partyId: string | null; buckets: Record<Bucket, number>; total: number; /** Money received or paid that no invoice or bill used up yet. */ unapplied: number; oldestDueDays: number };

const DAY = 86_400_000;
const empty = (): Record<Bucket, number> => ({ current: 0, d30: 0, d60: 0, d90: 0, over: 0 });

/** "Net 30" → 30. Anything unreadable falls back to `fallback`. */
export function termsDays(text: string | null | undefined, fallback = 30): number {
  const m = /(\d{1,3})/.exec(text ?? "");
  return m ? Number(m[1]) : fallback;
}

export function bucketOf(daysPastDue: number): Bucket {
  if (daysPastDue <= 0) return "current";
  if (daysPastDue <= 30) return "d30";
  if (daysPastDue <= 60) return "d60";
  if (daysPastDue <= 90) return "d90";
  return "over";
}

/**
 * Who owes what, and for how long. Per party, payments and credit notes settle the oldest invoices first; whatever is
 * left is aged from the invoice date plus the party's payment terms. `increase` is the side that raises the balance
 * (debit for receivables, credit for payables).
 */
export function ageParties(lines: AgeLine[], asOf: Date, increase: "debit" | "credit", terms: (partyId: string | null) => number): AgeRow[] {
  const by = new Map<string | null, AgeLine[]>();
  for (const l of lines) by.set(l.partyId, [...(by.get(l.partyId) ?? []), l]);
  const out: AgeRow[] = [];
  for (const [partyId, ls] of by) {
    const sorted = [...ls].sort((a, b) => a.date.getTime() - b.date.getTime());
    const open: { date: Date; left: number }[] = [];
    let settle = 0;
    for (const l of sorted) {
      const up = increase === "debit" ? l.debit - l.credit : l.credit - l.debit;
      if (up > 0) open.push({ date: l.date, left: up });
      else settle += -up;
    }
    for (const o of open) {
      const take = Math.min(o.left, settle);
      o.left = r2(o.left - take);
      settle = r2(settle - take);
    }
    const buckets = empty();
    let oldest = 0;
    for (const o of open) {
      if (o.left <= 0) continue;
      const past = Math.floor((asOf.getTime() - (o.date.getTime() + terms(partyId) * DAY)) / DAY);
      buckets[bucketOf(past)] = r2(buckets[bucketOf(past)] + o.left);
      oldest = Math.max(oldest, past);
    }
    const owed = r2(BUCKETS.reduce((s, k) => s + buckets[k], 0));
    if (owed === 0 && settle === 0) continue;
    out.push({ partyId, buckets, total: r2(owed - settle), unapplied: r2(settle), oldestDueDays: oldest });
  }
  return out.sort((a, b) => b.total - a.total);
}

export function ageTotals(rows: AgeRow[]) {
  const buckets = empty();
  for (const r of rows) for (const k of BUCKETS) buckets[k] = r2(buckets[k] + r.buckets[k]);
  return { buckets, unapplied: r2(rows.reduce((s, r) => s + r.unapplied, 0)), total: r2(rows.reduce((s, r) => s + r.total, 0)) };
}
