import type { FieldDef, Mapping } from "./types";

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "");
const tokens = (s: string) => s.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);

function similarity(a: string, b: string): number {
  if (a === b) return 1;
  if (!a || !b) return 0;
  const m = a.length, n = b.length;
  const prev = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    let last = prev[0];
    prev[0] = i;
    for (let j = 1; j <= n; j++) {
      const tmp = prev[j];
      prev[j] = Math.min(prev[j] + 1, prev[j - 1] + 1, last + (a[i - 1] === b[j - 1] ? 0 : 1));
      last = tmp;
    }
  }
  return 1 - prev[n] / Math.max(m, n);
}

/** How well a source header matches a field, 0..1. */
// "Trade licence number" and "Trade licence expiry" share most of their words
// but are different columns: a date column never fills a number field, or the
// other way round.
const DATEY = /\b(expiry|expires|expiration|exp|date|dob)\b/i;
const fieldIsDatey = (f: FieldDef) => DATEY.test(`${f.label} ${f.key.replace(/([A-Z])/g, " $1")}`);

export function scoreHeader(header: string, field: FieldDef): number {
  const h = norm(header);
  if (!h) return 0;
  if (!field.lenientDate && DATEY.test(header) !== fieldIsDatey(field)) return 0;
  const names = [field.label, field.key, ...(field.aliases ?? [])];
  let best = 0;
  for (const name of names) {
    const n = norm(name);
    if (!n) continue;
    if (h === n) return 1;
    // "Employee Name (as per passport)" still contains "employee name"
    if (n.length >= 5 && (h.includes(n) || (h.length >= 5 && n.includes(h)))) best = Math.max(best, 0.86);
    const ta = tokens(header), tb = tokens(name);
    const inter = ta.filter((t) => tb.includes(t)).length;
    const union = new Set([...ta, ...tb]).size;
    if (inter > 0) best = Math.max(best, 0.5 + 0.35 * (inter / union));
    const sim = similarity(h, n);
    if (sim >= 0.8) best = Math.max(best, sim * 0.9);
  }
  return best;
}

export type HeaderMatch = { header: string; field: string | null; confidence: number };

const AUTO = 0.7;

/** Match each source header to at most one field, and each field to at most one header. */
export function suggestMapping(headers: string[], fields: FieldDef[]): { columns: Record<string, string>; matches: HeaderMatch[] } {
  const pairs: { header: string; field: string; score: number }[] = [];
  for (const h of headers) for (const f of fields) {
    const score = scoreHeader(h, f);
    if (score >= AUTO) pairs.push({ header: h, field: f.key, score });
  }
  pairs.sort((a, b) => b.score - a.score);
  const columns: Record<string, string> = {};
  const usedHeaders = new Set<string>();
  const conf = new Map<string, { field: string; confidence: number }>();
  for (const p of pairs) {
    if (columns[p.field] || usedHeaders.has(p.header)) continue;
    columns[p.field] = p.header;
    usedHeaders.add(p.header);
    conf.set(p.header, { field: p.field, confidence: p.score });
  }
  return {
    columns,
    matches: headers.map((h) => ({ header: h, field: conf.get(h)?.field ?? null, confidence: conf.get(h)?.confidence ?? 0 })),
  };
}

export function isComplete(mapping: Mapping, fields: FieldDef[]): { missing: FieldDef[] } {
  return { missing: fields.filter((f) => f.required && !mapping.columns[f.key]) };
}
