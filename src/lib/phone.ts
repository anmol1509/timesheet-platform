/**
 * Phone-number normalisation for sign-in. Numbers in the employee records are
 * free text ("050 123 4567", "+971-50-1234567", "00971501234567"), so both sides
 * are reduced to E.164 before comparing.
 *
 * Local UAE numbers (leading 0, 10 digits, e.g. 0501234567) are read as +971.
 * Anything else must arrive with its country code.
 */
export const DEFAULT_COUNTRY_CODE = "971";

export function normalizePhone(input: string | null | undefined, defaultCc = DEFAULT_COUNTRY_CODE): string | null {
  if (!input) return null;
  const hasPlus = input.trim().startsWith("+");
  let digits = input.replace(/\D/g, "");
  if (!digits) return null;
  if (!hasPlus && digits.startsWith("00")) digits = digits.slice(2);
  else if (!hasPlus && digits.startsWith("0")) digits = defaultCc + digits.slice(1);
  else if (!hasPlus && defaultCc === "971" && digits.length === 9 && digits.startsWith("5")) digits = defaultCc + digits;
  if (digits.length < 8 || digits.length > 15) return null;
  return `+${digits}`;
}

/** Last 9 digits — enough to shortlist rows in SQL before the exact E.164 check. */
export const phoneTail = (e164: string) => e164.replace(/\D/g, "").slice(-9);

/** "+971501234567" -> "+971 ••••• 4567" — enough to recognise, not to reveal. */
export function maskPhone(e164: string): string {
  const d = e164.replace(/\D/g, "");
  return `+${d.slice(0, 3)} ${"•".repeat(Math.max(3, d.length - 7))} ${d.slice(-4)}`;
}
