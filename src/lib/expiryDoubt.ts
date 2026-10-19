/** Longest a document of each type normally stays valid, in years from today. A later date is probably the wrong date. */
const MAX_YEARS: Record<string, number> = {
  PASSPORT: 11,
  EMIRATES_ID: 6,
  VISA: 6,
  RESIDENCY_ISSUANCE: 6,
  LABOR_CARD: 4,
  MEDICAL: 2,
  DRIVING_LICENCE: 11,
};

/** Why an expiry date read off a scan deserves a second look, or null when it looks fine. `today` and `expiry` are YYYY-MM-DD. */
export function expiryDoubt(type: string, expiry: string | null | undefined, today: string): string | null {
  if (!expiry || !/^\d{4}-\d{2}-\d{2}$/.test(expiry)) return null;
  if (expiry < today) return "already expired, check the date on the scan";
  const years = MAX_YEARS[type];
  if (years) {
    const limit = `${Number(today.slice(0, 4)) + years}${today.slice(4)}`;
    if (expiry > limit) return "too far ahead for this document, check the date on the scan";
  }
  return null;
}
