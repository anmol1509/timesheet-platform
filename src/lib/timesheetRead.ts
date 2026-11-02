/** What the AI reads off a scanned monthly timesheet, and how it is cleaned before it reaches the grid. */
export type ReadTimesheetRow = { employeeIdNo: string; employeeName: string; trade: string; days: string[] };

/** One cell of a day grid: hours as a number, "A" for absent, "OFF" for a day off, or empty. Anything else is dropped, not guessed. */
export function cleanDayValue(raw: unknown): string {
  const s = String(raw ?? "").trim();
  if (!s) return "";
  const n = Number(s.replace(/h(ours?|rs?)?$/i, "").trim());
  if (Number.isFinite(n) && n >= 0 && n <= 24) return String(n);
  if (/^(a|abs|absent)$/i.test(s)) return "A";
  if (/^(off|o|fri|friday|sun|sunday|holiday|h|leave|l|rest|weekly off|w\/o)$/i.test(s)) return "OFF";
  return "";
}

/** Rows with their days cleaned and made exactly `dayCount` long; rows with neither an ID nor a name are dropped. */
export function cleanTimesheetRows(raw: unknown, dayCount: number): ReadTimesheetRow[] {
  const list = Array.isArray(raw) ? raw : [];
  const out: ReadTimesheetRow[] = [];
  for (const r of list) {
    if (!r || typeof r !== "object") continue;
    const o = r as Record<string, unknown>;
    const employeeIdNo = String(o.employeeIdNo ?? "").trim();
    const employeeName = String(o.employeeName ?? "").trim();
    if (!employeeIdNo && !employeeName) continue;
    const days = Array.isArray(o.days) ? o.days : [];
    out.push({ employeeIdNo, employeeName, trade: String(o.trade ?? "").trim(), days: Array.from({ length: dayCount }, (_, i) => cleanDayValue(days[i])) });
  }
  return out;
}

const key = (s: string) => s.trim().toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

/** Finds the roster person a scanned row is about: by ID first, else by an exact name (ignoring case and punctuation). */
export function matchRoster<T extends { employeeIdNo: string; name: string }>(row: { employeeIdNo: string; employeeName: string }, roster: T[]): T | null {
  const id = row.employeeIdNo.trim().toLowerCase();
  if (id) {
    const byId = roster.find((r) => r.employeeIdNo.trim().toLowerCase() === id);
    if (byId) return byId;
  }
  const n = key(row.employeeName);
  if (!n) return null;
  const byName = roster.filter((r) => key(r.name) === n);
  return byName.length === 1 ? byName[0] : null;
}
