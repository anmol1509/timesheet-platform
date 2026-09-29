import type { ImportRowResult } from "@/components/import/report";

/** Trimmed text of a cell, or "" when absent. */
export function cellOf(r: Record<string, string>, label: string): string {
  return (r[label] ?? "").trim();
}

export const blank = (s: string) => (s === "" ? null : s);

/** Yes / true / 1 / y → true; no / false / 0 / n → false; anything else → undefined (leave as is). */
export function yesNo(s: string): boolean | undefined {
  const t = s.trim().toLowerCase();
  if (["yes", "y", "true", "1", "on"].includes(t)) return true;
  if (["no", "n", "false", "0", "off"].includes(t)) return false;
  return undefined;
}

export function rowError(i: number, name: string | undefined, message: string): ImportRowResult {
  return { row: i + 2, name, status: "error", message };
}
