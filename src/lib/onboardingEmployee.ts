/**
 * The rules for turning an onboarding candidate into an employee, kept pure so they can be tested: what files carry over and as
 * what, how the pay set-up typed on the review screen becomes pay fields, and what is essential before it can go ahead.
 */

/** A candidate's file, filed under the step it was attached to, becomes a worker document of the nearest type. */
const DOC_TYPE_FOR_STEP: Record<string, string> = {
  PASSPORT: "PASSPORT",
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
