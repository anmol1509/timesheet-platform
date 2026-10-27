/**
 * Telling when two people on file are probably the same person, so a new one isn't typed in twice. Pure, so the screens
 * and the server use the same rule and it can be tested without a database.
 */

/** Lower case, no accents, titles or punctuation, words in order: "Mr. Khalid  Al-Mansoori" and "khalid al mansoori" match. */
export function normalizeName(name: string): string {
  return name
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\b(mr|mrs|ms|miss|dr|eng|sheikh|shaikh)\b\.?/g, " ")
    .replace(/[^a-z0-9؀-ۿ]+/g, " ")
    .trim();
}

/**
 * Same words in any order too ("Al Mansoori Khalid"), so a swapped family name still counts; and initials written apart
 * or together are the same ("Chandan B K" and "Chandan BK").
 */
const key = (name: string) => {
  const words: string[] = [];
  let initials = "";
  for (const w of normalizeName(name).split(" ").filter(Boolean)) {
    if (w.length === 1) { initials += w; continue; }
    if (initials) { words.push(initials); initials = ""; }
    words.push(w);
  }
  if (initials) words.push(initials);
  return words.sort().join(" ");
};

export const sameName = (a: string, b: string) => {
  const ka = key(a);
  return ka.length >= 3 && ka === key(b);
};

/** People whose name matches what was typed. */
export function similarPeople<T extends { name: string }>(typed: string, people: T[]): T[] {
  return people.filter((p) => sameName(typed, p.name));
}

/** Groups of two or more people sharing a name, largest first. */
export function duplicateGroups<T extends { name: string }>(people: T[]): T[][] {
  const by = new Map<string, T[]>();
  for (const p of people) {
    const k = key(p.name);
    if (k.length < 3) continue;
    by.set(k, [...(by.get(k) ?? []), p]);
  }
  return [...by.values()].filter((g) => g.length > 1).sort((a, b) => b.length - a.length || a[0].name.localeCompare(b[0].name));
}

const words = (name: string) => normalizeName(name).split(" ").filter(Boolean);

/** Edit distance between two short strings (typos: "Mohamed" / "Mohammed"). */
function distance(a: string, b: string): number {
  const prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let diag = prev[0];
    prev[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const up = prev[j];
      prev[j] = Math.min(prev[j] + 1, prev[j - 1] + 1, diag + (a[i - 1] === b[j - 1] ? 0 : 1));
      diag = up;
    }
  }
  return prev[b.length];
}

/** Whether two words are the same word allowing a small slip (one letter off on words of five letters or more). */
const closeWord = (a: string, b: string) => a === b || (Math.min(a.length, b.length) >= 5 && distance(a, b) <= 1);

/**
 * People whose name is close to a typed one but not the same: most of the words shared, allowing a slipped letter or a
 * missing middle name ("Mohammed Ali Khan" / "Mohamed Khan"). Best first, at most `max`. For "did you mean?" prompts only;
 * nothing is linked from a near match without a person saying so.
 */
export function nearPeople<T extends { name: string }>(typed: string, people: T[], max = 3): T[] {
  const t = words(typed);
  if (t.length === 0) return [];
  const scored = people
    .filter((p) => !sameName(typed, p.name))
    .map((p) => {
      const w = words(p.name);
      const shared = t.filter((x) => w.some((y) => closeWord(x, y))).length;
      return { p, shared, score: shared / Math.max(t.length, w.length) };
    })
    // Two or more words in common, or every word of a short name, and at least half of the longer name.
    .filter((x) => x.score >= 0.5 && (x.shared >= 2 || (t.length === 1 && x.shared === 1)))
    .sort((a, b) => b.score - a.score || a.p.name.localeCompare(b.p.name));
  return scored.slice(0, max).map((x) => x.p);
}
