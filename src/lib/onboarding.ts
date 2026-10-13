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

export type CandidateType = "OVERSEAS" | "INSIDE_UAE";
export const CANDIDATE_TYPES: { value: CandidateType; label: string; hint: string }[] = [
  { value: "OVERSEAS", label: "Overseas hire", hint: "Comes from abroad: entry permit, travel and arrival." },
  { value: "INSIDE_UAE", label: "Inside-UAE transfer", hint: "Already in the UAE: the permit is transferred, no travel." },
];

export type StageKey =
  | "HIRE_APPROVAL"
  | "INTERVIEW"
  | "CLIENT_APPROVAL"
  | "PERMIT_TRANSFER"
  | "OFFER"
  | "WPP"
  | "WORK_PERMIT_PAYMENT"
  | "ENTRY_PERMIT"
  | "ARRIVAL"
  | "MEDICAL"
  | "TAWJEEH"
  | "ILOE"
  | "HEALTH_CARD"
  | "EID_BIOMETRICS"
  | "CONTRACT"
  | "ID_VISA";

export type Stage = {
  key: StageKey;
  label: string;
  /** Short label for narrow table columns. */
  short: string;
  /** The CandidateOnboarding column this stage's current status lives in. */
  field:
    | "hireApprovalStatus"
    | "interviewStatus"
    | "clientApprovalStatus"
    | "permitTransferStatus"
    | "offerStatus"
    | "wppStatus"
    | "workPermitPaymentStatus"
    | "entryPermitStatus"
    | "arrivalStatus"
    | "medicalStatus"
    | "tawjeehStatus"
    | "iloeStatus"
    | "healthCardStatus"
    | "eidBiometricsStatus"
    | "contractStatus"
    | "idVisaStatus";
  statuses: { value: string; kind: StatusKind }[];
  /** Which kinds of candidate go through this step. */
  types: CandidateType[];
  /** An optional step starts as "Not Required" and counts as done until someone switches it on. */
  optional?: boolean;
  /** An arrival paper that has to be done before the worker's papers are complete. */
  gate?: boolean;
  /** Typical turnaround for this stage, in calendar days — a candidate still
   * pending at this stage past this many days shows as overdue on the
   * dashboard. Rough defaults for a UAE manpower operation; not a hard SLA. */
  slaDays: number;
};

/**
 * The pipeline a candidate goes through before they are an employee. The papers that follow arrival (medical, Tawjeeh, ILOE,
 * contract, ID and visa) belong to the employee and are listed in AFTER_ARRIVAL_STAGES.
 */
export const STAGES: Stage[] = [
  {
    key: "HIRE_APPROVAL",
    label: "Hire Approval",
    short: "Approval",
    field: "hireApprovalStatus",
    slaDays: 2,
    types: ["OVERSEAS", "INSIDE_UAE"],
    optional: true,
    statuses: [
      { value: "Not Required", kind: "done" },
      { value: "Pending", kind: "pending" },
      { value: "Approved", kind: "done" },
      { value: "Rejected", kind: "issue" },
    ],
  },
  {
    key: "INTERVIEW",
    label: "Interview & Trade Test",
    short: "Interview",
    field: "interviewStatus",
    slaDays: 5,
    types: ["OVERSEAS", "INSIDE_UAE"],
    optional: true,
    statuses: [
      { value: "Not Required", kind: "done" },
      { value: "Pending", kind: "pending" },
      { value: "Scheduled", kind: "progress" },
      { value: "Passed", kind: "done" },
      { value: "Failed", kind: "issue" },
    ],
  },
  {
    key: "CLIENT_APPROVAL",
    label: "Client Approval",
    short: "Client",
    field: "clientApprovalStatus",
    slaDays: 3,
    types: ["OVERSEAS", "INSIDE_UAE"],
    optional: true,
    statuses: [
      { value: "Not Required", kind: "done" },
      { value: "Pending", kind: "pending" },
      { value: "Sent to Client", kind: "progress" },
      { value: "Approved", kind: "done" },
      { value: "Rejected", kind: "issue" },
    ],
  },
  {
    key: "OFFER",
    label: "Offer Letter",
    short: "Offer",
    field: "offerStatus",
    slaDays: 2,
    types: ["OVERSEAS", "INSIDE_UAE"],
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
    short: "WPP",
    field: "wppStatus",
    slaDays: 3,
    types: ["OVERSEAS"],
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
    short: "WP Payment",
    field: "workPermitPaymentStatus",
    slaDays: 2,
    types: ["OVERSEAS"],
    statuses: [
      { value: "Pending", kind: "pending" },
      { value: "Payment Requested", kind: "progress" },
      { value: "Payment Completed", kind: "done" },
    ],
  },
  {
    key: "ENTRY_PERMIT",
    label: "Entry Permit",
    short: "Entry Permit",
    field: "entryPermitStatus",
    slaDays: 7,
    types: ["OVERSEAS"],
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
    short: "Arrival",
    field: "arrivalStatus",
    slaDays: 5,
    types: ["OVERSEAS"],
    statuses: [
      { value: "Travel Pending", kind: "pending" },
      { value: "Flight Booked", kind: "progress" },
      { value: "Arrived UAE", kind: "done" },
      { value: "No Show", kind: "issue" },
      { value: "Cancelled", kind: "issue" },
    ],
  },
  {
    key: "PERMIT_TRANSFER",
    label: "Permit Transfer",
    short: "Transfer",
    field: "permitTransferStatus",
    slaDays: 7,
    types: ["INSIDE_UAE"],
    statuses: [
      { value: "Pending", kind: "pending" },
      { value: "Applied", kind: "progress" },
      { value: "Approved", kind: "progress" },
      { value: "Completed", kind: "done" },
      { value: "Rejected", kind: "issue" },
    ],
  },
];

/**
 * The arrival papers: steps done once the person is in the country. They are not part of the pipeline or of "ready to join", but
 * they stay on the candidate (after they have joined too) and are tracked here, so a worker whose medical, visa stamping or labour
 * card isn't finished shows as "papers pending" in onboarding.
 */
export const AFTER_ARRIVAL_STAGES: Stage[] = [
  {
    key: "MEDICAL",
    label: "Medical Fitness",
    short: "Medical",
    field: "medicalStatus",
    slaDays: 2,
    gate: true,
    types: ["OVERSEAS", "INSIDE_UAE"],
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
    short: "Tawjeeh",
    field: "tawjeehStatus",
    slaDays: 2,
    types: ["OVERSEAS", "INSIDE_UAE"],
    statuses: [
      { value: "Pending", kind: "pending" },
      { value: "Scheduled", kind: "progress" },
      { value: "Completed", kind: "done" },
    ],
  },
  {
    key: "ILOE",
    label: "ILOE Insurance",
    short: "ILOE",
    field: "iloeStatus",
    slaDays: 1,
    types: ["OVERSEAS", "INSIDE_UAE"],
    statuses: [
      { value: "Pending", kind: "pending" },
      { value: "Applied", kind: "progress" },
      { value: "Completed", kind: "done" },
    ],
  },
  {
    key: "HEALTH_CARD",
    label: "Health Insurance Card",
    short: "Health card",
    field: "healthCardStatus",
    slaDays: 7,
    types: ["OVERSEAS", "INSIDE_UAE"],
    statuses: [
      { value: "Not Needed", kind: "done" },
      { value: "Pending", kind: "pending" },
      { value: "Applied", kind: "progress" },
      { value: "Issued", kind: "done" },
    ],
  },
  {
    key: "EID_BIOMETRICS",
    label: "Emirates ID Biometrics",
    short: "EID",
    field: "eidBiometricsStatus",
    slaDays: 5,
    types: ["OVERSEAS", "INSIDE_UAE"],
    statuses: [
      { value: "Pending", kind: "pending" },
      { value: "Appointment Booked", kind: "progress" },
      { value: "Done", kind: "done" },
    ],
  },
  {
    key: "ID_VISA",
    label: "Residence Visa Stamping",
    short: "ID/Visa",
    field: "idVisaStatus",
    gate: true,
    slaDays: 5,
    types: ["OVERSEAS", "INSIDE_UAE"],
    statuses: [
      { value: "Pending", kind: "pending" },
      { value: "Submitted", kind: "progress" },
      { value: "Under Process", kind: "progress" },
      { value: "Completed", kind: "done" },
      { value: "Rejected", kind: "issue" },
    ],
  },
  {
    key: "CONTRACT",
    label: "Contract & Labour Card",
    short: "Contract",
    field: "contractStatus",
    gate: true,
    slaDays: 2,
    types: ["OVERSEAS", "INSIDE_UAE"],
    statuses: [
      { value: "Pending", kind: "pending" },
      { value: "Submitted", kind: "progress" },
      { value: "Approved", kind: "done" },
      { value: "Issued", kind: "done" },
      { value: "Rejected", kind: "issue" },
    ],
  },
];

export const STAGE_BY_KEY: Record<StageKey, Stage> = Object.fromEntries([...STAGES, ...AFTER_ARRIVAL_STAGES].map((s) => [s.key, s])) as Record<StageKey, Stage>;

/** The row shape every stage-status field lives on — a subset of CandidateOnboarding. */
export type OnboardingStatuses = { [K in Stage["field"]]: string } & { candidateType?: string | null };

export const asCandidateType = (v: string | null | undefined): CandidateType => (v === "INSIDE_UAE" ? "INSIDE_UAE" : "OVERSEAS");

/** The steps that apply to this kind of candidate, in order. */
export const stagesFor = (type: string | null | undefined): Stage[] => {
  const t = asCandidateType(type);
  return STAGES.filter((s) => s.types.includes(t));
};

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
  return stagesFor(row.candidateType).every((stage) => isStageDone(stage, row[stage.field]));
}

/** The first stage (in pipeline order) that isn't done yet — "where this
 * candidate is currently stuck" for the dashboard's work queue. Null once
 * every stage is done (i.e. once they're ready to join). */
export function currentStage(row: OnboardingStatuses): Stage | null {
  return stagesFor(row.candidateType).find((stage) => !isStageDone(stage, row[stage.field])) ?? null;
}

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

export function daysSince(date: Date): number {
  return Math.max(0, Math.floor((Date.now() - date.getTime()) / ONE_DAY_MS));
}

/** A one-line summary of where a candidate stands, for list rows and headers. */
export function overallStatusLabel(row: OnboardingStatuses & { joined: boolean; readyToJoin: boolean }): string {
  if (row.joined) return "Joined";
  if (row.readyToJoin) return "Ready to join";
  const stage = currentStage(row);
  return stage ? `${statusKind(stage, row[stage.field]) === "issue" ? "Blocked at" : "At"} ${stage.label}` : "In progress";
}

/** Whether a candidate has been sitting at their current stage longer than
 * that stage's typical turnaround — the dashboard's overdue flag. */
export function isOverdue(row: OnboardingStatuses & { joined: boolean }, sinceUpdatedAt: Date): boolean {
  if (row.joined) return false;
  const stage = currentStage(row);
  if (!stage) return false;
  return daysSince(sinceUpdatedAt) > stage.slaDays;
}


/** Whether the arrival papers matter yet: once the person has arrived, or has been added as an employee. */
export function papersApply(row: OnboardingStatuses & { joined: boolean }): boolean {
  return row.joined || row.arrivalStatus === "Arrived UAE" || stagesFor(row.candidateType).some((s) => s.key === "PERMIT_TRANSFER" && isStageDone(s, row[s.field]));
}

/** The papers that gate a worker being fully cleared (medical fit, visa stamped, labour card) and aren't done yet. */
export function pendingPapers(row: OnboardingStatuses): Stage[] {
  return AFTER_ARRIVAL_STAGES.filter((s) => s.gate && !isStageDone(s, row[s.field]));
}

/** True when the person is here (or already an employee) but their medical, visa or labour card isn't finished. */
export function papersPending(row: OnboardingStatuses & { joined: boolean }): boolean {
  return papersApply(row) && pendingPapers(row).length > 0;
}
