/** The largest amount any entry may carry (the column holds 14 digits; this keeps typing slips from reaching it). */
export const MAX_AMOUNT = 100_000_000_000;

/** An error message when an amount is not usable as money, otherwise null. */
export function amountError(n: number, label = "amount"): string | null {
  if (!Number.isFinite(n) || n <= 0) return `Enter an ${label} above zero.`;
  if (n > MAX_AMOUNT) return `That ${label} is too large. Check the digits.`;
  return null;
}
