/**
 * Candidate Onboarding Tracker — the pipeline an agency-sourced candidate
 * goes through between "received from the agency" and "joined", before they
 * become a real Employee (visa/labour card issued). Kept as its own module
 * rather than bolted onto Employee/WorkerSubmission so pre-employment
 * candidates never leak into workforce lists, idle-worker counts or payroll.
 *
 * Each stage's status is a plain string (matches this codebase's convention
 * for status fields — see DemandRequest.status, WorkerSubmission.status —
 * rather than a DB enum), classified below into one of four buckets so the
 * tracker table and dashboard can render a consistent ✓ / ● / — / ✕ without
 * hand-checking strings all over the UI.
 */

export type StatusKind = "pending" | "progress" | "done" | "issue";

export type StageKey =
  | "OFFER"
  | "WPP"
  | "WORK_PERMIT_PAYMENT"
  | "ENTRY_PERMIT"
  | "ARRIVAL"
  | "MEDICAL"
  | "TAWJEEH"
  | "ILOE"
  | "CONTRACT"
  | "ID_VISA";

export type Stage = {
  key: StageKey;
  label: string;
  /** The CandidateOnboarding column this stage's current status lives in. */
  field:
    | "offerStatus"
    | "wppStatus"
    | "workPermitPaymentStatus"
    | "entryPermitStatus"
    | "arrivalStatus"
    | "medicalStatus"
    | "tawjeehStatus"
    | "iloeStatus"
    | "contractStatus"
    | "idVisaStatus";
  statuses: { value: string; kind: StatusKind }[];
};

export const STAGES: Stage[] = [
  {
    key: "OFFER",
    label: "Offer Letter",
    field: "offerStatus",
    statuses: [
      { value: "Pending", kind: "pending" },
      { value: "Prepared", kind: "progress" },
      { value: "Sent", kind: "progress" },
      { value: "Accepted", kind: "done" },
      { value: "Rejected", kind: "issue" },
    ],
  },
  {
    key: "WPP",
    label: "WPP Insurance",
    field: "wppStatus",
    statuses: [
      { value: "Pending", kind: "pending" },
      { value: "Submitted", kind: "progress" },
      { value: "Approved", kind: "progress" },
      { value: "Completed", kind: "done" },
    ],
  },
  {
    key: "WORK_PERMIT_PAYMENT",
    label: "Work Permit Payment",
    field: "workPermitPaymentStatus",
    statuses: [
      { value: "Pending", kind: "pending" },
      { value: "Payment Requested", kind: "progress" },
      { value: "Payment Completed", kind: "done" },
    ],
  },
  {
    key: "ENTRY_PERMIT",
    label: "Entry Permit",
    field: "entryPermitStatus",
    statuses: [
      { value: "Pending", kind: "pending" },
      { value: "Applied", kind: "progress" },
      { value: "Approved", kind: "progress" },
      { value: "Received", kind: "done" },
      { value: "Expired", kind: "issue" },
      { value: "Rejected", kind: "issue" },
    ],
  },
  {
    key: "ARRIVAL",
    label: "Arrival",
    field: "arrivalStatus",
    statuses: [
      { value: "Travel Pending", kind: "pending" },
      { value: "Flight Booked", kind: "progress" },
      { value: "Arrived UAE", kind: "done" },
      { value: "No Show", kind: "issue" },
      { value: "Cancelled", kind: "issue" },
    ],
  },
  {
    key: "MEDICAL",
    label: "Medical",
    field: "medicalStatus",
    statuses: [
      { value: "Pending", kind: "pending" },
      { value: "Appointment Booked", kind: "progress" },
      { value: "Completed", kind: "progress" },
      { value: "Fit", kind: "done" },
      { value: "Unfit", kind: "issue" },
    ],
  },
  {
    key: "TAWJEEH",
    label: "Tawjeeh",
    field: "tawjeehStatus",
    statuses: [
      { value: "Pending", kind: "pending" },
      { value: "Scheduled", kind: "progress" },
      { value: "Completed", kind: "done" },
    ],
  },
  {
    key: "ILOE",
    label: "ILOE Insurance",
    field: "iloeStatus",
    statuses: [
      { value: "Pending", kind: "pending" },
      { value: "Applied", kind: "progress" },
      { value: "Completed", kind: "done" },
    ],
  },
  {
    key: "CONTRACT",
    label: "Contract Submission",
    field: "contractStatus",
    statuses: [
      { value: "Pending", kind: "pending" },
      { value: "Submitted", kind: "progress" },
      { value: "Approved", kind: "done" },
      { value: "Rejected", kind: "issue" },
    ],
  },
  {
    key: "ID_VISA",
    label: "ID & Visa Stamping",
    field: "idVisaStatus",
    statuses: [
      { value: "Pending", kind: "pending" },
      { value: "Submitted", kind: "progress" },
      { value: "Under Process", kind: "progress" },
      { value: "Completed", kind: "done" },
      { value: "Rejected", kind: "issue" },
    ],
  },
];

export const STAGE_BY_KEY: Record<StageKey, Stage> = Object.fromEntries(STAGES.map((s) => [s.key, s])) as Record<StageKey, Stage>;

/** The row shape every stage-status field lives on — a subset of CandidateOnboarding. */
export type OnboardingStatuses = { [K in Stage["field"]]: string };

export function statusKind(stage: Stage, status: string): StatusKind {
  return stage.statuses.find((s) => s.value === status)?.kind ?? "progress";
}

export function isStageDone(stage: Stage, status: string): boolean {
  return statusKind(stage, status) === "done";
}

/** Every mandatory stage is at its terminal "done" status — computed by the
 * app on every stage update, never entered by hand (see the ERP requirement
 * this mirrors: HR shouldn't be able to fat-finger someone into Ready). */
export function computeReadyToJoin(row: OnboardingStatuses): boolean {
  return STAGES.every((stage) => isStageDone(stage, row[stage.field]));
}

/** The first stage (in pipeline order) that isn't done yet — "where this
 * candidate is currently stuck" for the dashboard's work queue. Null once
 * every stage is done (i.e. once they're ready to join). */
export function currentStage(row: OnboardingStatuses): Stage | null {
  return STAGES.find((stage) => !isStageDone(stage, row[stage.field])) ?? null;
}

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

export function daysSince(date: Date): number {
  return Math.max(0, Math.floor((Date.now() - date.getTime()) / ONE_DAY_MS));
}
