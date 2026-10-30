/** The distinct values in a column as filter choices, sorted by label; blanks are left out. */
export function optionsOf<T>(rows: T[], get: (row: T) => string | null | undefined, label: (value: string) => string = (v) => v): { value: string; label: string }[] {
  const seen = new Set<string>();
  for (const r of rows) {
    const v = get(r);
    if (v) seen.add(v);
  }
  return [...seen].map((value) => ({ value, label: label(value) })).sort((a, b) => a.label.localeCompare(b.label));
}
