/** Rules and shaping for the supplier attendance report — pure, so the page and both exports agree. */
export const REPORT_STATUSES = ["ALL", "PRESENT", "ABSENT", "LEAVE"] as const;
export type ReportStatus = (typeof REPORT_STATUSES)[number];
export const MAX_RANGE_DAYS = 92;
const DAY = 86_400_000;

export type ReportRange = { from: Date; to: Date; status: ReportStatus };

function parseDay(s: string | undefined): Date | null {
  if (!s || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const d = new Date(`${s}T00:00:00Z`);
  return Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== s ? null : d;
}

/** Defaults to the current month; rejects reversed or over-long ranges instead of quietly clamping them. */
export function parseRange(q: { from?: string; to?: string; status?: string }, now: Date): { ok: true; range: ReportRange } | { ok: false; error: string; range: ReportRange } {
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const status = (REPORT_STATUSES as readonly string[]).includes(q.status ?? "") ? (q.status as ReportStatus) : "ALL";
  const fallback: ReportRange = { from: monthStart, to: today, status };
  if (!q.from && !q.to) return { ok: true, range: fallback };
  const from = parseDay(q.from);
  const to = parseDay(q.to);
  if (!from || !to) return { ok: false, error: "Enter both dates.", range: fallback };
  if (to.getTime() < from.getTime()) return { ok: false, error: "The end date is before the start date.", range: fallback };
  if ((to.getTime() - from.getTime()) / DAY + 1 > MAX_RANGE_DAYS) return { ok: false, error: `Choose a range of at most ${MAX_RANGE_DAYS} days.`, range: fallback };
  return { ok: true, range: { from, to, status } };
}

export type ReportRow = { code: string; name: string; date: string; status: string; normal: number; ot: number };

export function summarise(rows: ReportRow[]) {
  const workers = new Set(rows.map((r) => r.code));
  return {
    workers: workers.size,
    days: rows.length,
    present: rows.filter((r) => r.status === "PRESENT").length,
    absent: rows.filter((r) => r.status === "ABSENT").length,
    leave: rows.filter((r) => r.status === "LEAVE").length,
    normal: Math.round(rows.reduce((s, r) => s + r.normal, 0) * 100) / 100,
    ot: Math.round(rows.reduce((s, r) => s + r.ot, 0) * 100) / 100,
  };
}
