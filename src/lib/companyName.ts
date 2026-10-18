/**
 * Does the company name on a scanned document belong to the supplier or client it is being filed against?
 * Legal forms and punctuation differ between a licence and a record ("AL NOOR MANPOWER SERVICES L.L.C." against
 * "Al Noor Manpower Services LLC"), and a licence often prints the full word where a record keeps an abbreviation
 * ("CONT" against "CONTRACTING"), so names are compared as sets of significant words. The words that say what a
 * company does are kept: "Al Noor Manpower Services" and "Al Noor Labour Supply" are different companies.
 */
const LEGAL = new Set([
  "LLC", "LTD", "LIMITED", "CO", "COMPANY", "INC", "INCORPORATED", "FZE", "FZCO", "FZ", "FZLLC", "PJSC", "PSC", "LLP", "EST", "ESTABLISHMENT",
  "SOLE", "PROPRIETORSHIP", "BRANCH", "THE", "OF", "AND", "WLL", "SPC", "CORP", "CORPORATION", "PVT", "PRIVATE", "UAE", "DUBAI",
]);

const words = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/&/g, " AND ")
    .replace(/\bL\.?\s?L\.?\s?C\.?(?=\W|$)/g, " LLC ")
    .replace(/['’`]/g, "")
    .replace(/[^A-Z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 0 && !LEGAL.has(w));

function sameWord(a: string, b: string): boolean {
  if (a === b) return true;
  const [short, long] = a.length <= b.length ? [a, b] : [b, a];
  if (short.length >= 4 && long.startsWith(short)) return true; // CONT / CONTRACTING
  if (short.length >= 5 && long.length - short.length <= 1) {
    let i = 0, j = 0, edits = 0;
    while (i < short.length && j < long.length) {
      if (short[i] === long[j]) { i++; j++; continue; }
      if (++edits > 1) return false;
      if (long.length > short.length) j++; else { i++; j++; }
    }
    return edits + (short.length - i) + (long.length - j) <= 1;
  }
  return false;
}

function oneMatch(documentName: string, recordName: string): boolean {
  const a = words(documentName);
  const b = words(recordName);
  if (a.length === 0 || b.length === 0) return true;
  const unused = [...b];
  let shared = 0;
  for (const w of a) {
    const i = unused.findIndex((x) => sameWord(w, x));
    if (i >= 0) { shared++; unused.splice(i, 1); }
  }
  // Most of the shorter name must be found in the other.
  return shared >= Math.max(1, Math.ceil(0.7 * Math.min(a.length, b.length)));
}

/** True when the name plausibly matches any of the company's names. An unreadable name is never a mismatch. */
export function companyNameMatches(documentName: string | null | undefined, recordNames: (string | null | undefined)[]): boolean {
  const doc = (documentName ?? "").trim();
  const names = recordNames.map((n) => (n ?? "").trim()).filter(Boolean);
  if (!doc || names.length === 0) return true;
  return names.some((n) => oneMatch(doc, n));
}
