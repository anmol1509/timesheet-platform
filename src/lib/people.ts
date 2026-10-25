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

/** Same words in any order too ("Al Mansoori Khalid"), so a swapped family name still counts. */
const key = (name: string) => normalizeName(name).split(" ").filter(Boolean).sort().join(" ");

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
