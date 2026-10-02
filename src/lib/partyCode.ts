// Supplier codes are "S" (clients "C") plus the initials of the name — "Gulf Skills Contracting" is
// SGSC — so a code reads at a glance without looking like a running count of
// companies. Pure, so the form's button and the server agree on the rule.
const SKIP = new Set(["and", "the", "of", "&"]);
const MAX_INITIALS = 4;
export const SUPPLIER_PREFIX = "S";
export const CLIENT_PREFIX = "C";

function words(name: string): string[] {
  return name.split(/[^A-Za-z0-9]+/).filter((w) => w && !SKIP.has(w.toLowerCase()));
}

/** Candidate codes for a name, best first. Later ones take more letters of the
 * first word, so a second "G… Skills Contracting" stays apart from
 * "Gulf Skills Contracting" (SGSC) without a number. */
export function codeCandidates(name: string, prefix: string = SUPPLIER_PREFIX): string[] {
  const w = words(name);
  if (w.length === 0) return [prefix + (prefix === CLIENT_PREFIX ? "CLI" : "SUP")];
  // One word ("Emaar") has no initials to combine; use its first letters.
  if (w.length === 1) {
    return [2, 3, 4, 5].map((n) => prefix + w[0].slice(0, n).toUpperCase());
  }
  const rest = w.slice(1, MAX_INITIALS).map((x) => x[0]).join("");
  const out: string[] = [];
  for (let n = 1; n <= Math.min(4, w[0].length); n++) {
    out.push((prefix + w[0].slice(0, n) + rest).toUpperCase());
  }
  return out;
}

export function acronymFor(name: string): string {
  return codeCandidates(name)[0];
}

/** Trim, upper-case and keep only letters, digits and dashes. */
export function normalizeCode(raw: string): string {
  return raw
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9-]/g, "")
    .slice(0, 12);
}

/** Names from spreadsheets differ in case, dots and spacing ("Cont." vs "cont"). */
export function nameKey(name: string): string {
  const k = name.toLowerCase().replace(/[^a-z0-9]+/g, "");
  return k || name.trim().toLowerCase();
}

/** The first candidate code for `name` that isn't in `taken` (a number as a last resort). */
export function pickCode(name: string, taken: Set<string | null>, prefix: string = SUPPLIER_PREFIX): string {
  const candidates = codeCandidates(name, prefix);
  const free = candidates.find((c) => !taken.has(c));
  if (free) return free;
  const base = candidates[candidates.length - 1];
  for (let n = 2; ; n++) if (!taken.has(`${base}${n}`)) return `${base}${n}`;
}
