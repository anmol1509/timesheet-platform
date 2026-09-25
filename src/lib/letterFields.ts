import { LETTER_MERGE_FIELDS, type MergeField } from "@/lib/letterLayout";
import { ASK_PREFIX, tokensIn } from "@/lib/letterHtml";

export type Audience = "SITE" | "EMPLOYEE";

/** Fields for letters about one employee (salary certificates, experience letters, warnings…). */
export const EMPLOYEE_MERGE_FIELDS: (MergeField & { sensitive?: boolean })[] = [
  { key: "EMPLOYEENAME", label: "Employee name", example: "AJAY KUMAR" },
  { key: "EMPLOYEEID", label: "Employee ID", example: "BAACCC002" },
  { key: "DESIGNATION", label: "Trade / designation", example: "Helper" },
  { key: "NATIONALITY", label: "Nationality", example: "Indian" },
  { key: "PASSPORTNO", label: "Passport number", example: "N1234567" },
  { key: "EMIRATESID", label: "Emirates ID", example: "784-1990-1234567-1" },
  { key: "JOINDATE", label: "Joining date", example: "01-03-2024" },
  { key: "PROJECTNAME", label: "Current project", example: "R1117/1 Improvement Of Al Mustaqbal Road" },
  { key: "BASICSALARY", label: "Basic salary (AED)", example: "1,200.00", sensitive: true },
  { key: "TOTALSALARY", label: "Total monthly salary (AED)", example: "1,800.00", sensitive: true },
  { key: "COMPANYNAME", label: "Company name", example: "ACME CONCRETE CARPENTER CONT" },
  { key: "BRANCHNAME", label: "Branch", example: "Dubai" },
  { key: "DATE", label: "Today's date", example: "27-07-2026" },
  { key: "REFNO", label: "Letter reference no.", example: "LTR-000123" },
];

export const fieldsFor = (audience: Audience): MergeField[] => (audience === "EMPLOYEE" ? EMPLOYEE_MERGE_FIELDS : LETTER_MERGE_FIELDS);

export const knownKeys = (audience: Audience) => new Set(fieldsFor(audience).map((f) => f.key));

/** Fields in a body that aren't real (they would print blank). "Ask when issuing" prompts are fine for employee letters. */
export function unknownFieldsIn(html: string, audience: Audience): string[] {
  const known = knownKeys(audience);
  if (audience === "SITE") known.add("SPONSORSHIPCOMPANYNAME");
  return [...new Set(tokensIn(html).filter((t) => !known.has(t) && !(audience === "EMPLOYEE" && t.startsWith(ASK_PREFIX) && t.length > ASK_PREFIX.length)))];
}
