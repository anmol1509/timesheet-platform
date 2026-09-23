/** Escapes one CSV cell. Also defuses spreadsheet formula injection: a cell
 * starting with = + - @ is prefixed with an apostrophe so Excel/Sheets treat
 * it as text — audit rows echo user-typed values, so this matters. */
export function csvCell(value: unknown): string {
  let s = value === null || value === undefined ? "" : typeof value === "object" ? JSON.stringify(value) : String(value);
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(header: string[], rows: unknown[][]): string {
  return "﻿" + [header, ...rows].map((r) => r.map(csvCell).join(",")).join("\r\n") + "\r\n";
}
