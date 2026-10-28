/**
 * AI credits: pure rules, no database. Every AI call reports the tokens it used; a credit is a fixed amount of that, so
 * the bar means the same thing whichever feature spent it. One credit is 1,000 input tokens, with output counted five times
 * (it costs five times as much), on the standard model. A model that costs more per token counts for more, and a cheaper one for less.
 */

/**
 * What a model's tokens count for, against the standard model (Haiku 4.5, $1 per million input tokens). It follows each model's
 * list price, so a model that costs a tenth counts for a tenth. Unknown models count as the standard one.
 * Prices per million input tokens: Haiku 5.5 $0.10, Haiku 4.5 $1, Sonnet 5.x $2 (older Sonnet $3), Opus 5.5 $4,
 * other Opus $5, Fable and Mythos $10.
 */
export function modelWeight(model: string): number {
  const m = model.toLowerCase();
  if (m.includes("haiku-5")) return 0.1;
  if (m.includes("haiku")) return 1;
  if (m.includes("sonnet-5")) return 2;
  if (m.includes("sonnet")) return 3;
  if (m.includes("opus-5-5")) return 4;
  if (m.includes("opus")) return 5;
  if (m.includes("fable") || m.includes("mythos")) return 10;
  return 1;
}

/** The credits one call used, to two decimals (never below 0.01 for a real call). */
export function creditsFor(model: string, inputTokens: number, outputTokens: number): number {
  const raw = ((Math.max(0, inputTokens) + 5 * Math.max(0, outputTokens)) / 1000) * modelWeight(model);
  return raw <= 0 ? 0 : Math.max(0.01, Math.round(raw * 100) / 100);
}

/** "2026-10" for the month a moment falls in, in UAE time (UTC+4, no daylight saving), so the month turns over at UAE midnight. */
export function monthKey(now: Date = new Date()): string {
  const d = new Date(now.getTime() + 4 * 3600_000);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** The first moment of a month key and of the next one, as UTC instants (UAE midnight is 20:00 UTC the evening before). */
export function monthRange(key: string): { start: Date; end: Date } {
  const [y, m] = key.split("-").map(Number);
  return { start: new Date(Date.UTC(y, m - 1, 1) - 4 * 3600_000), end: new Date(Date.UTC(y, m, 1) - 4 * 3600_000) };
}

export type CreditLevel = "ok" | "warn" | "out";

export type CreditStatus = {
  month: string;
  /** The monthly allowance plus anything granted this month. */
  total: number;
  used: number;
  remaining: number;
  /** 0 to 100, how much of the total is used. */
  pct: number;
  level: CreditLevel;
  /** The day the allowance starts again, as a UTC instant. */
  resetsAt: Date;
};

/** Where a branch stands: warn from 80% used, out at 100%. A branch with no allowance at all is out. */
export function creditStatus(input: { allowance: number; granted: number; used: number; now?: Date }): CreditStatus {
  const month = monthKey(input.now);
  const total = Math.max(0, input.allowance) + Math.max(0, input.granted);
  const used = Math.max(0, Math.round(input.used * 100) / 100);
  const remaining = Math.max(0, Math.round((total - used) * 100) / 100);
  const pct = total <= 0 ? 100 : Math.min(100, Math.round((used / total) * 100));
  const level: CreditLevel = total <= 0 || used >= total ? "out" : used >= total * 0.8 ? "warn" : "ok";
  return { month, total, used, remaining, pct, level, resetsAt: monthRange(month).end };
}

/** The warning to send now (80 or 100), or null: only when it is higher than the one already sent for this month. */
export function warningDue(status: CreditStatus, sent: { month: string | null; level: number }): 80 | 100 | null {
  const want = status.level === "out" ? 100 : status.level === "warn" ? 80 : 0;
  if (want === 0) return null;
  const already = sent.month === status.month ? sent.level : 0;
  return want > already ? (want as 80 | 100) : null;
}

/** The message shown where an AI feature is switched off because the allowance is used up. */
export const OUT_OF_CREDITS = "This month's AI credits are used up, so AI is paused until they reset. You can still do this by hand. Ask your administrator for more credits.";

/** Who an AI call is charged to: the branch, and the person who asked when known. */
export type AiMeter = { branchId: string | null | undefined; userId?: string | null };

/** What each feature is called on the usage page. An unlisted one is shown as it was recorded. */
export const FEATURE_LABEL: Record<string, string> = {
  assistant: "My Assistant",
  "document-extract": "Reading documents when adding an employee",
  "employee-extract": "Reading a list of employees from a file",
  "company-extract": "Reading company documents",
  "document-name": "Naming and dating other documents",
  "document-recheck": "Re-checking a document's expiry",
  receipt: "Reading expense receipts",
  "import-documents": "Bulk document upload",
  "import-matching": "Matching names in imports",
  "import-copilot": "Checking a timesheet import",
};

/** What extra credits cost when a company asks for a top-up: 1,000 credits are AED 10. Shown only where a top-up is requested. */
export const TOP_UP_AED_PER_1000 = 10;

/** The price shown beside a top-up amount, e.g. "AED 10" or "AED 12.50". */
export function topUpPriceLabel(credits: number): string {
  const aed = Math.round((credits / 1000) * TOP_UP_AED_PER_1000 * 100) / 100;
  return `AED ${Number.isInteger(aed) ? aed.toLocaleString("en-US") : aed.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
