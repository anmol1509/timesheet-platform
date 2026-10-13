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

export type PayChoice = "LATER" | "FLAT" | "ITEMISED" | "HOURLY";

export type PayInput = { choice: PayChoice; flat?: number | null; basic?: number | null; housing?: number | null; food?: number | null; transport?: number | null; other?: number | null; hourly?: number | null };

/** The employee pay columns for what was typed, or an error in plain words. "Set later" leaves pay alone. */
export function payFieldsFor(p: PayInput): { error: string } | { fields: Record<string, unknown> } {
  const amounts = [p.flat, p.basic, p.housing, p.food, p.transport, p.other, p.hourly];
  if (amounts.some((a) => a != null && (!Number.isFinite(a) || a < 0))) return { error: "Pay amounts can't be negative." };
  if (p.choice === "FLAT") {
    if (!p.flat) return { error: "Enter the monthly salary, or choose Set later." };
    return { fields: { payStructure: "FLAT", flatMonthlyRate: p.flat, payOverride: true } };
  }
  if (p.choice === "ITEMISED") {
    if (!p.basic) return { error: "Enter the basic salary, or choose Set later." };
    return { fields: { payStructure: "ITEMISED", basicSalary: p.basic, housingAllowance: p.housing ?? null, foodAllowance: p.food ?? null, transportAllowance: p.transport ?? null, otherAllowance: p.other ?? null, payOverride: true } };
  }
  if (p.choice === "HOURLY") {
    if (!p.hourly) return { error: "Enter the hourly rate, or choose Set later." };
    return { fields: { payStructure: "HOURLY", hourlyRate: p.hourly, payOverride: true } };
  }
  return { fields: {} };
}

/** What has to be there before someone can be added as an employee. The rest can be filled in later. */
export function missingEssentials(f: { name?: string | null; passportNumber?: string | null; supplierId?: string | null }): string[] {
  const out: string[] = [];
  if (!f.name?.trim()) out.push("name");
  if (!f.passportNumber?.trim()) out.push("passport number");
  if (!f.supplierId) out.push("company");
  return out;
}
