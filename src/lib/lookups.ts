import { LOOKUP_CATEGORIES } from "@/lib/lookupCategories";

type LookupRow = { category: string; value: string };

// Groups a flat LookupValue[] (already branch/isActive-filtered by the
// caller's query) into { CATEGORY_KEY: {value}[] } for feeding Select
// options on the Employee form.
export function groupLookups(rows: LookupRow[]): Record<string, { value: string }[]> {
  const grouped: Record<string, { value: string }[]> = {};
  for (const { key } of LOOKUP_CATEGORIES) grouped[key] = [];
  for (const row of rows) {
    if (!grouped[row.category]) grouped[row.category] = [];
    grouped[row.category].push({ value: row.value });
  }
  return grouped;
}
