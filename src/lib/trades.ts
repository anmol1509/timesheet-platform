/**
 * The trades this company hires for.
 *
 * This is a closed list, not a suggestion: every trade dropdown for site staff
 * offers these and nothing else. Free text was what let "Carpentry",
 * "carpenter", "F Carpenter" and "car" all become separate trades, which broke
 * matching workers to a demand.
 *
 * Taken from the client's own trade list (Trade List.xlsx).
 */
export const TRADES = [
  "Helper",
  "Mason",
  "Tile Mason",
  "Steel Fixer",
  "Shuttering Carpenter",
  "Scaffolder",
  "Painter",
  "Finishing Carpenter",
  "Gypsum Carpenter",
  "Electrician",
  "Plumber",
  "Rigger",
  "ARC Welder",
  "Site Supervisor",
] as const;

export type Trade = (typeof TRADES)[number];

/** Case-insensitive lookup, so stored spellings still resolve to the list. */
export function canonicalTrade(value: string | null | undefined): Trade | null {
  if (!value) return null;
  const needle = value.trim().toLowerCase();
  return TRADES.find((t) => t.toLowerCase() === needle) ?? null;
}

export function isCanonicalTrade(value: string | null | undefined): boolean {
  return canonicalTrade(value) !== null;
}

/** How a worker is paid for a trade. */
export const RATE_TYPES = [
  { value: "HOURLY", label: "Hourly" },
  { value: "FIXED", label: "Fixed" },
] as const;

export type RateType = (typeof RATE_TYPES)[number]["value"];

/** Lowercase, punctuation collapsed to single spaces, for comparison only. */
function normalise(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

/**
 * Best-effort mapping of a free-text designation onto the trade list.
 *
 * Used when names arrive from a document — a workmen's-compensation schedule
 * prints whatever the insurer typed. An exact match wins; otherwise a trade
 * qualifies if one name contains the other as whole words, which catches
 * "Civil Helper" -> Helper and "Welder" -> ARC Welder.
 *
 * Ambiguity returns null on purpose. "Carpenter" fits Shuttering, Finishing
 * and Gypsum Carpenter equally, and guessing one would put a worker on the
 * wrong trade — a blank is honest and gets corrected, a wrong trade doesn't
 * get noticed.
 */
export function matchTrade(value: string | null | undefined): Trade | null {
  if (!value) return null;
  const input = normalise(value);
  if (!input) return null;

  const exact = TRADES.find((t) => normalise(t) === input);
  if (exact) return exact;

  const contains = (haystack: string, needle: string) =>
    ` ${haystack} `.includes(` ${needle} `);

  const candidates = TRADES.filter((t) => {
    const trade = normalise(t);
    return contains(trade, input) || contains(input, trade);
  });

  return candidates.length === 1 ? candidates[0] : null;
}
