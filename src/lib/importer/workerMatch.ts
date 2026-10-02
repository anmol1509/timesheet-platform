// Pure (no server imports): lining up a name typed in a spreadsheet with the workers on record.

export type RosterPerson = { id: string; name: string; employeeIdNo: string; trade?: string | null; supplier?: string | null };

const tokens = (s: string) => s.toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter(Boolean);

/** Exact-name key: case, spacing and punctuation ignored. */
export const exactKey = (s: string) => tokens(s).join(" ");

function lev(a: string, b: string): number {
  if (a === b) return 0;
  const m = a.length, n = b.length;
  if (!m) return n;
  if (!n) return m;
  let prev = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    const cur = [i];
    for (let j = 1; j <= n; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    prev = cur;
  }
  return prev[n];
}

/** How alike two names are, 0..1. Order-free, forgiving of spelling slips, short forms (Mohd / Mohammed) and a missing middle name. */
export function nameSimilarity(a: string, b: string): number {
  const ta = tokens(a), tb = tokens(b);
  if (!ta.length || !tb.length) return 0;
  const tokenScore = (x: string, y: string) => {
    if (x === y) return 1;
    if (x.length >= 2 && y.length >= 2 && (x.startsWith(y) || y.startsWith(x))) return 0.85; // Mohd / Mohammed, R / Ravi
    if (x.length === 1 || y.length === 1) return x[0] === y[0] ? 0.6 : 0; // an initial
    return Math.max(0, 1 - lev(x, y) / Math.max(x.length, y.length));
  };
  // Each word of the shorter name is matched to its best word in the longer one.
  const [short, long] = ta.length <= tb.length ? [ta, tb] : [tb, ta];
  const used = new Set<number>();
  let total = 0;
  for (const w of short) {
    let best = 0, at = -1;
    long.forEach((v, i) => { if (used.has(i)) return; const sc = tokenScore(w, v); if (sc > best) { best = sc; at = i; } });
    if (at >= 0) used.add(at);
    total += best;
  }
  const coverage = short.length / long.length; // "Ravi Kumar" inside "Ravi Kumar Singh" is a good, not perfect, fit
  return (total / short.length) * (0.7 + 0.3 * coverage);
}

/** The closest workers to a typed name, best first. */
export function rankCandidates<T extends RosterPerson>(typed: string, roster: T[], limit = 6, floor = 0.45): (T & { score: number })[] {
  return roster
    .map((p) => ({ ...p, score: nameSimilarity(typed, p.name) }))
    .filter((p) => p.score >= floor)
    .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name))
    .slice(0, limit);
}
