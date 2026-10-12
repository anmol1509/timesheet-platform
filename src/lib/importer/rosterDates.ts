// Pure: reading the check-in / check-out dates of a roster sheet.
//
// Spreadsheets kept by hand mix two things in one column: dates typed as text in day/month/year
// ("31/08/2026") and cells Excel turned into real dates. Excel reads "03/09/2026" in US order, so a
// day-first 3 September arrives as 9 March. The text ones are trustworthy; a real date whose day is
// 12 or less may have its day and month swapped. We pick whichever reading falls nearer to the
// dates we can trust, and say so, so nothing is changed silently.

import { parseLooseDate } from "@/lib/looseDate";

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const key = (d: Date) => d.toISOString().slice(0, 10);

export type DateRead = { iso: string | null; corrected: boolean; original: string; invalid: boolean };

export function readRosterDates(raws: string[]): DateRead[] {
  type P = { raw: string; date: Date | null; invalid: boolean; fromCell: boolean };
  const parsed: P[] = raws.map((raw) => {
    const t = raw.trim();
    if (!t) return { raw: t, date: null, invalid: false, fromCell: false };
    if (ISO.test(t)) {
      const d = new Date(`${t}T00:00:00Z`);
      return { raw: t, date: Number.isNaN(d.getTime()) ? null : d, invalid: Number.isNaN(d.getTime()), fromCell: true };
    }
    const d = parseLooseDate(t);
    return d === "invalid" ? { raw: t, date: null, invalid: true, fromCell: false } : { raw: t, date: d, invalid: false, fromCell: false };
  });

  // Dates we can trust: typed text, and real dates whose day is above 12 (those can't have been swapped).
  const trusted = parsed.filter((p) => p.date && (!p.fromCell || p.date.getUTCDate() > 12)).map((p) => p.date!.getTime()).sort((a, b) => a - b);
  const median = trusted.length >= 3 ? trusted[Math.floor(trusted.length / 2)] : null;

  return parsed.map((p) => {
    if (!p.date) return { iso: null, corrected: false, original: p.raw, invalid: p.invalid };
    const d = p.date;
    const swappable = p.fromCell && median !== null && d.getUTCDate() <= 12 && d.getUTCDate() !== d.getUTCMonth() + 1;
    if (swappable) {
      const alt = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCDate() - 1, d.getUTCMonth() + 1));
      if (Math.abs(alt.getTime() - median!) < Math.abs(d.getTime() - median!)) return { iso: key(alt), corrected: true, original: p.raw, invalid: false };
    }
    return { iso: key(d), corrected: false, original: p.raw, invalid: false };
  });
}
