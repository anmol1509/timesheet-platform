// Pure (no server imports).

/** Words that only say what kind of company it is. "Prime Build Workforce LLC" and "Prime Build Workforce" are one company. */
const LEGAL = new Set([
  "llc", "ll", "l", "c", "ltd", "limited", "co", "company", "inc", "incorporated", "corp", "corporation", "plc",
  "fze", "fzc", "fzco", "fz", "est", "establishment", "pvt", "private", "pty", "the", "and",
]);

/**
 * A name with case, punctuation and trailing legal-form words ignored.
 * Only the endings are dropped ("L.L.C", "Co", "FZE"), never words in the middle,
 * so "Al Noor Manpower" and "Al Noor Manpower Supply" stay different companies.
 */
export function looseNameKey(name: string): string {
  const tokens = name
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[.’']/g, "")
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
  // "L.L.C" arrives as l l c: undo that before trimming endings.
  const joined: string[] = [];
  for (let i = 0; i < tokens.length; i++) {
    if (tokens[i] === "l" && tokens[i + 1] === "l" && tokens[i + 2] === "c") {
      joined.push("llc");
      i += 2;
    } else joined.push(tokens[i]);
  }
  while (joined.length > 1 && LEGAL.has(joined[joined.length - 1])) joined.pop();
  while (joined.length > 1 && joined[0] === "the") joined.shift();
  return joined.join("");
}

/** The one existing name that is the same company apart from legal-form words, or null when none or more than one fits. */
export function looseMatch<T extends { name: string }>(name: string, existing: T[]): T | null {
  const key = looseNameKey(name);
  if (!key) return null;
  const hits = existing.filter((e) => looseNameKey(e.name) === key);
  return hits.length === 1 ? hits[0] : null;
}
