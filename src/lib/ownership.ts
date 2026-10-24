/**
 * Ownership of a company: its owners hold whole-percent shares that must add up to 100. Pure, so the rules the screens
 * show and the server enforces are the same code and can be tested without a database.
 */
export const OWNER_ROLE = "OWNER";
/** Roles a person can hold in a company. Only owners hold a share. */
export const HOLDS_SHARE = (role: string) => role === OWNER_ROLE;

export type OwnershipSummary = {
  owners: number;
  /** Sum of the shares that are set. */
  total: number;
  /** Owners whose share has not been chosen. */
  unset: number;
  /** What would bring the total to 100 (negative when over). */
  remaining: number;
  /** No owners at all, or every share chosen and the total exactly 100. */
  ok: boolean;
};

export function ownershipSummary(shares: (number | null | undefined)[]): OwnershipSummary {
  const set = shares.filter((s): s is number => typeof s === "number");
  const total = set.reduce((n, s) => n + s, 0);
  const unset = shares.length - set.length;
  return { owners: shares.length, total, unset, remaining: 100 - total, ok: shares.length === 0 || (unset === 0 && total === 100) };
}

/** The sentence for a summary that is not ok, or null when it is. */
export function ownershipProblem(s: OwnershipSummary): string | null {
  if (s.ok) return null;
  if (s.unset > 0) return `Choose a share for ${s.unset === 1 ? "each owner" : `all ${s.owners} owners`} — they must add up to 100%.`;
  return s.remaining > 0 ? `Owners' shares add up to ${s.total}%, ${s.remaining}% short of 100%.` : `Owners' shares add up to ${s.total}%, ${-s.remaining}% over 100%.`;
}

/** An even split that adds up to 100: one owner 100, two 50 and 50, three 34, 33 and 33. */
export function equalSplit(n: number): number[] {
  if (n <= 0) return [];
  const base = Math.floor(100 / n);
  const extra = 100 - base * n;
  return Array.from({ length: n }, (_, i) => base + (i < extra ? 1 : 0));
}

/** Whole percentages offered in the share dropdown. */
export const SHARE_OPTIONS = Array.from({ length: 100 }, (_, i) => i + 1);

export function isValidShare(n: unknown): n is number {
  return typeof n === "number" && Number.isInteger(n) && n >= 1 && n <= 100;
}
