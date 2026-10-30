/** The shape of a register row and the rules for what counts as a problem. Pure, so screens and tests can use it without the database. */

/** One owner, sponsor, partner or manager, with where they serve and how their documents stand. */
export type PersonRow = {
  id: string;
  name: string;
  nationality: string | null;
  phone: string | null;
  companies: { id: string; name: string; role: string; percent: number | null }[];
  companyCount: number;
  docs: number;
  /** Every problem a person has, not just the worst: someone can be expired and missing a required file at once. */
  flags: { none: boolean; expired: number; expiring: number; missing: number; noExpiry: number; unlinked: boolean };
  nextDays: number | null;
};

export type PersonFlag = "none" | "noexpiry" | "missing" | "expired" | "expiring" | "unlinked" | "ok";

/** Whether a person has this problem. "ok" means none of them. */
export function hasFlag(r: PersonRow, f: PersonFlag): boolean {
  const x = r.flags;
  if (f === "none") return x.none;
  if (f === "noexpiry") return x.noExpiry > 0;
  if (f === "missing") return x.missing > 0;
  if (f === "expired") return x.expired > 0;
  if (f === "expiring") return x.expiring > 0;
  if (f === "unlinked") return x.unlinked;
  return !x.none && !x.unlinked && x.expired + x.expiring + x.missing + x.noExpiry === 0;
}

/** The problems a person has, in plain words, worst first. Empty when everything is in order. */
export function problemLabels(r: PersonRow): string[] {
  const x = r.flags;
  return [
    x.unlinked ? "Not linked to a company" : "",
    x.none ? "No documents" : "",
    x.expired ? `${x.expired} expired` : "",
    x.expiring ? `${x.expiring} expiring soon` : "",
    x.missing ? `${x.missing} required missing` : "",
    x.noExpiry ? `${x.noExpiry} without expiry` : "",
  ].filter(Boolean);
}
