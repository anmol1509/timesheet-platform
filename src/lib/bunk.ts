/**
 * Bunk beds without a schema change: a berth in a bunk is a Bed whose label reads
 * "Bunk 03 · Upper" or "Bunk 03 · Lower". Anything else is a single bed. This file is the
 * only place that knows the convention, so screens group berths through it.
 */
export type Level = "Upper" | "Lower";

const BUNK = /^Bunk\s*(\d+)\s*[·\-–]\s*(Upper|Lower)$/i;

export const bunkLabel = (no: number, level: Level) => `Bunk ${String(no).padStart(2, "0")} · ${level}`;
export const singleLabel = (no: number) => `Bed ${String(no).padStart(2, "0")}`;

export function parseBerth(label: string): { bunkNo: number; level: Level } | null {
  const m = BUNK.exec(label.trim());
  return m ? { bunkNo: Number(m[1]), level: m[2].toLowerCase() === "upper" ? "Upper" : "Lower" } : null;
}

export type BedLike = { id: string; label: string };
export type BedGroup<B extends BedLike> = { kind: "single"; bed: B } | { kind: "bunk"; no: number; upper: B | null; lower: B | null };

/** Room contents in order: single beds and bunks, with each bunk's two berths paired. */
export function groupBeds<B extends BedLike>(beds: B[]): BedGroup<B>[] {
  const groups: BedGroup<B>[] = [];
  const bunks = new Map<number, Extract<BedGroup<B>, { kind: "bunk" }>>();
  for (const bed of beds) {
    const p = parseBerth(bed.label);
    if (!p) {
      groups.push({ kind: "single", bed });
      continue;
    }
    let g = bunks.get(p.bunkNo);
    if (!g) {
      g = { kind: "bunk", no: p.bunkNo, upper: null, lower: null };
      bunks.set(p.bunkNo, g);
      groups.push(g);
    }
    if (p.level === "Upper") g.upper = bed;
    else g.lower = bed;
  }
  return groups;
}

/** Highest bunk number already used in a room's labels, so new bunks continue the sequence. */
export function nextBunkNo(labels: string[]) {
  return labels.reduce((max, l) => Math.max(max, parseBerth(l)?.bunkNo ?? 0), 0) + 1;
}

/**
 * A bed as a person types it in a spreadsheet: "Bed 03", "3", "Bunk 02 · Upper", "Bunk 2 lower", "2U", "B2L".
 * A bare number means a single bed. Returns null when it can't be read.
 */
export function parseBedInput(raw: string): { kind: "single"; no: number } | { kind: "bunk"; no: number; level: Level } | null {
  const t = raw.trim().toLowerCase().replace(/[·\-–_,/]/g, " ").replace(/\s+/g, " ");
  if (!t) return null;
  let m = /^(?:bunk|bk|b)?\s*(\d+)\s*(u|upper|up|top|l|lower|low|bottom|bot)$/.exec(t);
  if (m) return { kind: "bunk", no: Number(m[1]), level: m[2].startsWith("u") || m[2] === "top" ? "Upper" : "Lower" };
  m = /^(?:bunk|bk)\s*(\d+)\s+(u|upper|up|top|l|lower|low|bottom|bot)$/.exec(t);
  if (m) return { kind: "bunk", no: Number(m[1]), level: m[2].startsWith("u") || m[2] === "top" ? "Upper" : "Lower" };
  m = /^(?:bed|single)?\s*(\d+)$/.exec(t);
  if (m) return { kind: "single", no: Number(m[1]) };
  return null;
}

/** The label a parsed bed has in the database. */
export const labelOfBed = (b: NonNullable<ReturnType<typeof parseBedInput>>) => (b.kind === "single" ? singleLabel(b.no) : bunkLabel(b.no, b.level));

/** Order to hand out free beds: single beds, then lower berths, then upper berths (people prefer the bottom bunk). */
export function bedPreference(label: string): number {
  const p = parseBerth(label);
  if (!p) return 0;
  return p.level === "Lower" ? 1 : 2;
}
