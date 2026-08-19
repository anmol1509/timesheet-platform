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
