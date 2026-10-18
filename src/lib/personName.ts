/**
 * Does a name read off a document belong to the person it is being filed against? Names arrive in a different
 * order (surname first on a passport), with middle names missing or extra, and spelt a little differently, so
 * names are compared as sets of words rather than as strings.
 */
const words = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/['’`]/g, "")
    .replace(/[^A-Z\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 1);

function editDistanceAtMostOne(a: string, b: string): boolean {
  if (a === b) return true;
  if (Math.abs(a.length - b.length) > 1) return false;
  let i = 0, j = 0, edits = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) { i++; j++; continue; }
    if (++edits > 1) return false;
    if (a.length > b.length) i++;
    else if (b.length > a.length) j++;
    else { i++; j++; }
  }
  return edits + (a.length - i) + (b.length - j) <= 1;
}

/** Two words are the same name if they match, or differ by one letter in a name long enough for that to be a spelling. */
const sameWord = (a: string, b: string) => a === b || (a.length >= 5 && b.length >= 5 && editDistanceAtMostOne(a, b));

/** True when the two names plausibly belong to one person. Unknown (empty) names are never a mismatch. */
export function namesMatch(documentName: string | null | undefined, personName: string | null | undefined): boolean {
  const a = words(documentName ?? "");
  const b = words(personName ?? "");
  if (a.length === 0 || b.length === 0) return true;
  const unused = [...b];
  let shared = 0;
  for (const w of a) {
    const i = unused.findIndex((x) => sameWord(w, x));
    if (i >= 0) { shared++; unused.splice(i, 1); }
  }
  return shared >= Math.min(2, a.length, b.length);
}

/** Why a document doesn't look like it belongs to this person; null when it does, or when we can't tell. */
export function identityMismatch(doc: { name?: string | null; dateOfBirth?: string | null }, person: { name: string; dateOfBirth?: string | null }): { kind: "name" | "birthdate"; documentName: string } | null {
  if (!namesMatch(doc.name, person.name)) return { kind: "name", documentName: (doc.name ?? "").trim() };
  // Same name, different birth date: probably two people who share a name.
  if (doc.dateOfBirth && person.dateOfBirth && doc.dateOfBirth.slice(0, 10) !== person.dateOfBirth.slice(0, 10)) return { kind: "birthdate", documentName: (doc.name ?? "").trim() };
  return null;
}
