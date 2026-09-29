// Supplier codes are the initials of the name — "Burj Al Aweer" is BAW — so a
// code reads at a glance in lists and on documents. Pure, so the form's
// button and the server agree on the rule.
const SKIP = new Set(["and", "the", "of", "&"]);
const MAX_LEN = 4;

export function acronymFor(name: string): string {
  const words = name
    .split(/[^A-Za-z0-9]+/)
    .filter((w) => w && !SKIP.has(w.toLowerCase()));
  if (words.length === 0) return "SUP";
  // One word ("Emaar") has no initials to combine; use its first letters.
  if (words.length === 1) return words[0].slice(0, 3).toUpperCase();
  return words
    .map((w) => w[0])
    .join("")
    .slice(0, MAX_LEN)
    .toUpperCase();
}

/** Trim, upper-case and keep only letters, digits and dashes. */
export function normalizeCode(raw: string): string {
  return raw
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9-]/g, "")
    .slice(0, 12);
}
