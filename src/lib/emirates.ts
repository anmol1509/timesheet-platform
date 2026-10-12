/** The seven emirates of the UAE. The Emirate field offers exactly these for the UAE, rather than every town in the country. */
export const UAE_EMIRATES = ["Abu Dhabi", "Dubai", "Sharjah", "Ajman", "Umm Al Quwain", "Ras Al Khaimah", "Fujairah"] as const;

const fold = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** The emirates matching what was typed, ones that start with it first. Empty text lists all seven. */
export function searchEmirates(query: string): string[] {
  const q = fold(query.trim());
  if (!q) return [...UAE_EMIRATES];
  const all = UAE_EMIRATES.filter((e) => fold(e).includes(q));
  return [...all.filter((e) => fold(e).startsWith(q)), ...all.filter((e) => !fold(e).startsWith(q))];
}
