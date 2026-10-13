/**
 * The arrival papers: the statutory steps that follow a worker landing in the UAE. They live on the employee (not in onboarding),
 * each with a status, date, reference and expiry. Three of them gate "papers pending": medical fit, visa stamped, labour card issued.
 * Pure, so the rules can be tested without a database.
 */
export type PaperKind = "pending" | "progress" | "done" | "issue";

export type PaperKey = "MEDICAL" | "TAWJEEH" | "ILOE" | "HEALTH_CARD" | "EID_BIOMETRICS" | "VISA_STAMPING" | "CONTRACT_LABOUR_CARD";

export type Paper = {
  key: PaperKey;
  label: string;
  statuses: { value: string; kind: PaperKind }[];
  /** Counts toward whether the worker's papers are complete. */
  gate: boolean;
  /** The worker field an expiry date typed here is also written to, so renewals and alerts see it. */
  expiryField?: "medicalExpiry" | "visaExpiry" | "laborCardExpiry";
  /** What the reference number means for this item. */
  referenceLabel: string;
};

export const PAPERS: Paper[] = [
  { key: "MEDICAL", label: "Medical fitness", gate: true, expiryField: "medicalExpiry", referenceLabel: "Certificate no.", statuses: [
    { value: "Pending", kind: "pending" }, { value: "Booked", kind: "progress" }, { value: "Done", kind: "progress" }, { value: "Fit", kind: "done" }, { value: "Unfit", kind: "issue" },
  ] },
  { key: "TAWJEEH", label: "Tawjeeh orientation", gate: false, referenceLabel: "Receipt no.", statuses: [
    { value: "Pending", kind: "pending" }, { value: "Scheduled", kind: "progress" }, { value: "Done", kind: "done" },
  ] },
  { key: "ILOE", label: "ILOE insurance", gate: false, referenceLabel: "Policy no.", statuses: [
    { value: "Pending", kind: "pending" }, { value: "Applied", kind: "progress" }, { value: "Done", kind: "done" },
  ] },
  { key: "HEALTH_CARD", label: "Health insurance card", gate: false, referenceLabel: "Card no.", statuses: [
    { value: "Not Needed", kind: "done" }, { value: "Pending", kind: "pending" }, { value: "Applied", kind: "progress" }, { value: "Issued", kind: "done" },
  ] },
  { key: "EID_BIOMETRICS", label: "Emirates ID biometrics", gate: false, referenceLabel: "Appointment ref.", statuses: [
    { value: "Pending", kind: "pending" }, { value: "Appointment Booked", kind: "progress" }, { value: "Done", kind: "done" },
  ] },
  { key: "VISA_STAMPING", label: "Residence visa stamping", gate: true, expiryField: "visaExpiry", referenceLabel: "Visa / file no.", statuses: [
    { value: "Pending", kind: "pending" }, { value: "Submitted", kind: "progress" }, { value: "Under Process", kind: "progress" }, { value: "Stamped", kind: "done" }, { value: "Rejected", kind: "issue" },
  ] },
  { key: "CONTRACT_LABOUR_CARD", label: "Contract and labour card", gate: true, expiryField: "laborCardExpiry", referenceLabel: "Labour card no.", statuses: [
    { value: "Pending", kind: "pending" }, { value: "Submitted", kind: "progress" }, { value: "Approved", kind: "progress" }, { value: "Issued", kind: "done" }, { value: "Rejected", kind: "issue" },
  ] },
];

export const PAPER_BY_KEY = Object.fromEntries(PAPERS.map((p) => [p.key, p])) as Record<PaperKey, Paper>;

export const paperKind = (paper: Paper, status: string): PaperKind => paper.statuses.find((s) => s.value === status)?.kind ?? "progress";

export type PaperRow = { item: string; status: string };

/** The gate items not yet done. A worker with no row for an item counts as still pending on it. */
export function pendingGateItems(rows: PaperRow[]): Paper[] {
  return PAPERS.filter((p) => p.gate && !rows.some((r) => r.item === p.key && paperKind(p, r.status) === "done"));
}

/** "Papers pending" is true while any gate item is outstanding. */
export const papersPendingFrom = (rows: PaperRow[]): boolean => pendingGateItems(rows).length > 0;

// ---- Carrying over what onboarding already recorded -------------------------------------------------------------

/** The candidate's old after-arrival step and the statuses it used, mapped to the new paper statuses. */
const CARRY: { item: PaperKey; field: string; stage: string; map: Record<string, string> }[] = [
  { item: "MEDICAL", field: "medicalStatus", stage: "MEDICAL", map: { "Appointment Booked": "Booked", Completed: "Done", Fit: "Fit", Unfit: "Unfit" } },
  { item: "TAWJEEH", field: "tawjeehStatus", stage: "TAWJEEH", map: { Scheduled: "Scheduled", Completed: "Done" } },
  { item: "ILOE", field: "iloeStatus", stage: "ILOE", map: { Applied: "Applied", Completed: "Done" } },
  { item: "CONTRACT_LABOUR_CARD", field: "contractStatus", stage: "CONTRACT", map: { Submitted: "Submitted", Approved: "Approved", Rejected: "Rejected" } },
  { item: "VISA_STAMPING", field: "idVisaStatus", stage: "ID_VISA", map: { Submitted: "Submitted", "Under Process": "Under Process", Completed: "Stamped", Rejected: "Rejected" } },
];

export type SeedRow = { item: PaperKey; status: string; statusDate: Date | null; referenceNo: string | null; expiryDate: Date | null };

/**
 * One row per paper, starting from what the candidate's onboarding recorded: the status mapped across, and the latest date,
 * reference and expiry noted against that step. Items onboarding never tracked start as Pending.
 */
export function seedPapers(
  candidate: Record<string, string>,
  history: { stage: string; statusDate: Date; referenceNo: string | null; expiryDate: Date | null }[] = [],
): SeedRow[] {
  return PAPERS.map((p) => {
    const carry = CARRY.find((c) => c.item === p.key);
    if (!carry) return { item: p.key, status: "Pending", statusDate: null, referenceNo: null, expiryDate: null };
    const status = carry.map[candidate[carry.field] ?? ""] ?? "Pending";
    const latest = (pick: (h: (typeof history)[number]) => unknown) => history.filter((h) => h.stage === carry.stage && pick(h)).sort((a, b) => b.statusDate.getTime() - a.statusDate.getTime())[0];
    const refRow = latest((h) => h.referenceNo);
    const expRow = latest((h) => h.expiryDate);
    const dateRow = history.filter((h) => h.stage === carry.stage).sort((a, b) => b.statusDate.getTime() - a.statusDate.getTime())[0];
    return { item: p.key, status, statusDate: status === "Pending" ? null : (dateRow?.statusDate ?? null), referenceNo: refRow?.referenceNo ?? null, expiryDate: expRow?.expiryDate ?? null };
  });
}
