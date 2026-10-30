/**
 * The next number in a series like PRJ014, QTN-000042 or INV-000007: one more than the highest number already used.
 * Counting the rows instead breaks as soon as numbers have gaps (imported records, deleted ones, a different start), because
 * the count lands on a number that is already taken. Pure, so it can be tested without a database.
 */
export function nextCode(prefix: string, width: number, existing: (string | null | undefined)[]): string {
  const re = new RegExp(`^${prefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(\\d+)$`);
  let max = 0;
  for (const code of existing) {
    const m = code ? re.exec(code.trim()) : null;
    if (m) max = Math.max(max, parseInt(m[1], 10));
  }
  return `${prefix}${String(max + 1).padStart(width, "0")}`;
}
