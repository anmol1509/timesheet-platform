/**
 * The rules for turning an onboarding candidate into an employee, kept pure so they can be tested: what files carry over and as
 * what, how the pay set-up typed on the review screen becomes pay fields, and what is essential before it can go ahead.
 */

/** A candidate's file, filed under the step it was attached to, becomes a worker document of the nearest type. */
const DOC_TYPE_FOR_STEP: Record<string, string> = {
  PASSPORT: "PASSPORT",
  EMIRATES_ID: "EMIRATES_ID",
  PHOTO: "PHOTO",
  ENTRY_PERMIT: "VISA",
  ID_VISA: "VISA",
  MEDICAL: "MEDICAL",
  WPP: "INSURANCE",
  ILOE: "INSURANCE",
};
export const employeeDocType = (candidateDocType: string): string => DOC_TYPE_FOR_STEP[candidateDocType] ?? "OTHER";

import { payFieldsFor, type PayChoice, type PayInput } from "@/lib/payFields";
export { payFieldsFor, type PayChoice, type PayInput };

/** What has to be there before someone can be added as an employee. The rest can be filled in later. */
export function missingEssentials(f: { name?: string | null; passportNumber?: string | null; supplierId?: string | null }): string[] {
  const out: string[] = [];
  if (!f.name?.trim()) out.push("name");
  if (!f.passportNumber?.trim()) out.push("passport number");
  if (!f.supplierId) out.push("company");
  return out;
}

/**
 * What a later step's expiry date means on the employee. Medical, visa stamping and the labour card are done after arrival, often
 * after the person has already been added; when one is recorded with an expiry date it is copied to the employee so renewals see it.
 * Returns nothing for steps that do not map to an employee date.
 */
export function employeeFieldsFromStage(stage: string, expiry: Date | null, referenceNo: string | null): Record<string, Date | string> {
  const out: Record<string, Date | string> = {};
  if (!expiry) return out;
  if (stage === "MEDICAL") out.medicalExpiry = expiry;
  else if (stage === "ID_VISA") { out.visaExpiry = expiry; if (referenceNo) out.visaNumber = referenceNo; }
  else if (stage === "CONTRACT") out.laborCardExpiry = expiry;
  return out;
}

/** A passport number that cannot be one (too short, or something other than letters and digits), or null when it looks fine. Empty is fine: it can come later. */
export function passportProblem(value: string | null | undefined): string | null {
  const v = (value ?? "").trim();
  if (!v) return null;
  return /^[A-Za-z0-9]{5,20}$/.test(v.replace(/[\s-]/g, "")) ? null : "Check the passport number: it is usually 6 to 9 letters and digits, with no symbols.";
}
