import type { RenewalItem } from "@/lib/renewals";

/** Where one renewal has got to. Kept per document and expiry date: a renewed document is a new renewal. */
export const RENEWAL_STATUSES = [
  { key: "NOT_STARTED", label: "Not started" },
  { key: "IN_PROGRESS", label: "In progress" },
  { key: "SUBMITTED", label: "Submitted" },
  { key: "DONE", label: "Done" },
] as const;

export type RenewalStatus = (typeof RENEWAL_STATUSES)[number]["key"];
export const RENEWAL_STATUS_KEYS: string[] = RENEWAL_STATUSES.map((s) => s.key);
export const renewalStatusLabel = (s: string) => RENEWAL_STATUSES.find((x) => x.key === s)?.label ?? s;

/** What names one renewal: whose, which document, and the date it runs out. */
export type RenewalRef = Pick<RenewalItem, "kind" | "subjectId" | "document" | "expiry">;
export const renewalKey = (r: RenewalRef) => `${r.kind}|${r.subjectId}|${r.document}|${r.expiry.slice(0, 10)}`;

export type RenewalCaseView = { status: RenewalStatus; ownerId: string | null; ownerName: string | null; note: string | null };

/** A renewal with its workflow state. */
export type RenewalRow = RenewalItem & { key: string } & RenewalCaseView;
