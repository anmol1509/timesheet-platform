import { payDataGap, wpsGaps, type CompanyPayType } from "@/lib/payroll";

/**
 * The reasoning behind the assistant's "why" answers, kept apart from the database so it can be tested:
 * the tools gather the facts, these turn them into plain causes with the fix.
 */

export type MissingFacts = {
  /** Where the worker's company stands. */
  company: { name: string; isOwnCompany: boolean; payType: CompanyPayType | null } | null;
  status: string; // employee status; TERMINATED is never paid
  /** Whether they were on the payroll at all that month (joined by month end and not left before it began). */
  employedInMonth: boolean;
  /** Effective pay on record. */
  pay: { payStructure: string | null; basicSalary: number; flatMonthlyRate: number; hourlyRate: number };
  /** Timesheet hours for the month when the worker is paid by the hour; null when that does not apply. */
  hourlyHours: number | null;
  runExists: boolean;
  inRun: boolean;
};

/** Plain-English reasons a worker is not in a month's payroll, most likely first. Empty when they are in it. */
export function missingFromPayrollReasons(f: MissingFacts): string[] {
  if (f.inRun) return [];
  const out: string[] = [];
  if (!f.company) out.push("The worker has no company set, so no payroll run can include them. Set their company on their record.");
  else if (!f.company.isOwnCompany) out.push(`${f.company.name} is not marked as an own company, and payroll is only for own companies. If it should be, tick \"Own company\" on its page under Suppliers.`);
  if (f.status === "TERMINATED") out.push("Their status is Terminated, and terminated workers are never in a payroll run.");
  if (!f.employedInMonth) out.push("They had not joined yet by the end of that month, or had left before it began, so they are not in that month's payroll.");
  const gap = payDataGap(f.company?.payType ?? null, f.pay);
  if (gap) out.push(`They can't be paid yet: ${gap}. Fix it on their Trade & pay tab.`);
  if (f.hourlyHours !== null && f.hourlyHours <= 0) out.push("They are paid by the hour but have no timesheet hours for that month, so they would be paid nothing. Add or import the month's timesheet.");
  if (!f.runExists) out.push("There is no payroll run for their company and that month yet. Start one on the Payroll page.");
  else if (out.length === 0) out.push("Everything on their record looks fine, so the run was probably built before this was set up. Open the run and press More › Recalculate.");
  return out;
}

export type BlockerFacts = {
  status: string; // run status
  submitted: boolean;
  lineCount: number;
  total: number;
  threshold: number | null;
  /** Workers whose bank details are incomplete, with what is missing. */
  bankGaps: { name: string; gaps: string[] }[];
};

/** Why a draft run can't be approved yet, in the order to deal with them. Empty when nothing is in the way. */
export function approvalBlockers(f: BlockerFacts): string[] {
  const out: string[] = [];
  if (f.status !== "DRAFT") return [`The run is already ${f.status.toLowerCase()}, so there is nothing to approve.`];
  if (f.lineCount === 0) out.push("The run has no workers in it. Check each worker has a pay structure on their Trade & pay tab, then press More › Recalculate.");
  if (!f.submitted) out.push("It has not been sent for approval. Open the run and press Submit for approval; approvers only see submitted runs in Approvals.");
  if (f.bankGaps.length > 0) {
    const list = f.bankGaps.slice(0, 5).map((b) => `${b.name} (${b.gaps.join(", ")})`).join("; ");
    out.push(`${f.bankGaps.length} worker${f.bankGaps.length === 1 ? " has" : "s have"} incomplete bank details: ${list}${f.bankGaps.length > 5 ? "…" : ""}. Fix them on the worker's Payroll & WPS tab, then press More › Recalculate.`);
  }
  if (f.threshold !== null && f.total > f.threshold) out.push(`The run total (AED ${f.total.toLocaleString("en-AE", { minimumFractionDigits: 2 })}) is over the branch's approval limit (AED ${f.threshold.toLocaleString("en-AE")}), so someone other than the person who created it has to approve it.`);
  return out;
}

export { wpsGaps };
