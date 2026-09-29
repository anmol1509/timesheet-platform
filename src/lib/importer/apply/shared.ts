import { logAudit } from "@/lib/audit";
import type { ApplyCtx } from "../types";

/** Audit entries go to the real database, so a dry run must not write them. */
export function auditor(ctx: ApplyCtx) {
  return (p: Parameters<typeof logAudit>[0]) => (ctx.audit ? logAudit(p) : Promise.resolve());
}

export const rowsLabel = (n: number) => `${n} row${n === 1 ? "" : "s"}`;

/** Names from spreadsheets: trim, collapse spaces. */
export const clean = (s: string | undefined) => (s ?? "").replace(/\s+/g, " ").trim();

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];

/** Dates as people write them here: 2026-08-03, 03/08/2026 (day first), 3-Aug-2026, 3 August 2026. */
export function parseLooseDate(input: string): Date | null | "invalid" {
  const s = input.trim();
  if (!s) return null;
  let y: number, m: number, d: number;
  let mt = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (mt) [y, m, d] = [+mt[1], +mt[2], +mt[3]];
  else if ((mt = s.match(/^(\d{1,2})[-/. ](\d{1,2})[-/. ](\d{2,4})$/))) {
    [d, m, y] = [+mt[1], +mt[2], +mt[3]];
    if (y < 100) y += 2000;
  } else if ((mt = s.match(/^(\d{1,2})[-/. ]([A-Za-z]{3,})[-/. ,]*(\d{2,4})$/))) {
    const mi = MONTHS.indexOf(mt[2].slice(0, 3).toLowerCase());
    if (mi < 0) return "invalid";
    [d, m, y] = [+mt[1], mi + 1, +mt[3]];
    if (y < 100) y += 2000;
  } else return "invalid";
  const date = new Date(Date.UTC(y, m - 1, d));
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d) return "invalid";
  return date;
}
