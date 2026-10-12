import type { ParsedMonth } from "@/lib/parseTimesheet";
import { normalizeNationality } from "@/lib/nationality";
import { recompute } from "@/lib/timesheetCells";
import type { Fix, Fixable } from "./types";

/**
 * Corrections to a parsed timesheet, typed in on the review screen.
 *
 * What comes back from the browser is untrusted, so every value is checked
 * here and a bad one is simply ignored (the problem then shows up again for
 * the person to fix). Totals are recomputed so a corrected rate or day flows
 * into the invoice value.
 */
const MAX_FIXABLE = 100;
const idKey = (id: string) => id.trim().toUpperCase();

export function collectFixables(months: ParsedMonth[]): Fixable[] {
  const rate: Fixable[] = [];
  const hours: Fixable[] = [];
  const nationality: Fixable[] = [];
  const seenNat = new Set<string>();
  for (const m of months) {
    for (const e of m.entries) {
      if (e.rate === 0 && rate.length < MAX_FIXABLE) {
        rate.push({ type: "rate", id: e.employeeIdNo, name: e.employeeName, month: m.month, monthLabel: m.monthLabel, current: "0" });
      }
      for (const d of e.dailyHours) {
        const n = Number(d.value);
        if (d.value === "" || Number.isNaN(n) || (n >= 0 && n <= 24) || !d.date || hours.length >= MAX_FIXABLE) continue;
        hours.push({ type: "hours", id: e.employeeIdNo, name: e.employeeName, month: m.month, monthLabel: m.monthLabel, date: d.date, current: d.value });
      }
      if (e.nationality && !seenNat.has(idKey(e.employeeIdNo)) && nationality.length < MAX_FIXABLE) {
        const r = normalizeNationality(e.nationality);
        if (!r.value && r.status !== "empty") {
          seenNat.add(idKey(e.employeeIdNo));
          nationality.push({ type: "nationality", id: e.employeeIdNo, name: e.employeeName, current: e.nationality.trim() });
        }
      }
    }
  }
  return [...rate, ...hours, ...nationality];
}

export function applyFixes(months: ParsedMonth[], fixes: Fix[]) {
  const list = (Array.isArray(fixes) ? fixes : []).slice(0, 500);
  for (const f of list) {
    if (!f || typeof f.id !== "string" || typeof f.value !== "string") continue;
    const value = f.value.trim();
    for (const m of months) {
      if (f.type !== "nationality" && f.month && f.month !== m.month) continue;
      for (const e of m.entries) {
        if (idKey(e.employeeIdNo) !== idKey(f.id)) continue;
        if (f.type === "rate") {
          const n = Number(value);
          if (value === "" || !Number.isFinite(n) || n <= 0 || n > 10000) continue;
          e.rate = n;
        } else if (f.type === "hours") {
          const cell = e.dailyHours.find((d) => d.date && d.date === f.date);
          const n = Number(value);
          if (!cell || (value !== "" && (!Number.isFinite(n) || n < 0 || n > 24))) continue;
          cell.value = value === "" ? "" : String(n);
          const t = recompute(e.dailyHours);
          e.totalHours = t.totalHours;
          e.absentCount = t.absentCount;
        } else if (f.type === "nationality") {
          const r = normalizeNationality(value);
          if (!r.value) continue;
          e.nationality = r.value;
        }
        e.invoiceValue = e.rate * e.totalHours;
      }
    }
  }
}
