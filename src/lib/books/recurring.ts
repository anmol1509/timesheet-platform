import { r2, utcDay, type Posting } from "./postings";

export type Frequency = "MONTHLY" | "QUARTERLY" | "YEARLY";
export type RecurringFacts = { id: string; name: string; frequency: Frequency; startDate: Date; endDate: Date | null; debitAccountId: string; creditAccountId: string; amount: number; active: boolean };

export const FREQUENCY_LABEL: Record<Frequency, string> = { MONTHLY: "Every month", QUARTERLY: "Every 3 months", YEARLY: "Every year" };
const STEP: Record<Frequency, number> = { MONTHLY: 1, QUARTERLY: 3, YEARLY: 12 };

/** The dates an entry falls due, from its start up to `until` (or its end date): the start day each period, shortened to month-end where needed. */
export function occurrences(r: Pick<RecurringFacts, "frequency" | "startDate" | "endDate">, until: Date): Date[] {
  const out: Date[] = [];
  const day = r.startDate.getUTCDate();
  const limit = r.endDate && r.endDate.getTime() < until.getTime() ? r.endDate : until;
  for (let i = 0; i < 1200; i++) {
    const months = r.startDate.getUTCMonth() + i * STEP[r.frequency];
    const y = r.startDate.getUTCFullYear() + Math.floor(months / 12);
    const m = ((months % 12) + 12) % 12;
    const last = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
    const d = new Date(Date.UTC(y, m, Math.min(day, last)));
    if (d.getTime() > limit.getTime()) break;
    out.push(d);
  }
  return out;
}

/** One balanced entry per due date, named by account so any account in the chart can be used. */
export function recurringPostings(r: RecurringFacts, opening: Date, today: Date): Posting[] {
  if (!r.active || r.amount <= 0) return [];
  return occurrences(r, today)
    .filter((d) => d.getTime() >= opening.getTime())
    .map((d) => ({
      sourceKey: `recurring:${r.id}:${d.toISOString().slice(0, 10)}`, date: utcDay(d), type: "JOURNAL", narration: r.name,
      lines: [{ tag: "RECURRING", debit: r2(r.amount), accountId: r.debitAccountId }, { tag: "RECURRING", credit: r2(r.amount), accountId: r.creditAccountId }],
    }));
}
