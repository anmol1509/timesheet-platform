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
  // Filled only on advance and loan letters (Payroll › Loans & advances); on any other letter they print blank.
  { key: "ADVANCEAMOUNT", label: "Advance: amount (AED)", example: "1,500.00" },
  { key: "ADVANCEWORDS", label: "Advance: amount in words", example: "One thousand five hundred dirhams only" },
  { key: "ADVANCEREF", label: "Advance: reference", example: "ADV-0007" },
  { key: "ADVANCETYPE", label: "Advance: advance or loan", example: "advance" },
  { key: "ADVANCEREASON", label: "Advance: reason", example: "Family emergency" },
  { key: "ADVANCEREQUESTEDON", label: "Advance: date requested", example: "01-10-2026" },
  { key: "ADVANCEREQUESTEDBY", label: "Advance: requested by", example: "HR Department" },
  { key: "ADVANCEAPPROVAL", label: "Advance: approval (who and when)", example: "Approved by Admin on 02-10-2026" },
  { key: "ADVANCEAPPROVEDBY", label: "Advance: approved by", example: "Admin" },
  { key: "ADVANCEAPPROVEDON", label: "Advance: date approved", example: "02-10-2026" },
  { key: "ADVANCEGIVEN", label: "Advance: date handed over", example: "03-10-2026" },
  { key: "ADVANCEPAYMENT", label: "Advance: how it was paid", example: "cash, ref VCH-221" },
  { key: "ADVANCEPLAN", label: "Advance: how it is deducted, month by month", example: "November 2026: AED 500.00; December 2026: AED 500.00" },
  { key: "ADVANCEBALANCE", label: "Advance: balance still to deduct (AED)", example: "1,000.00" },
  // The employee's bank details, for a salary transfer letter. Need payroll access.
  { key: "BANKNAME", label: "Employee's bank (for salary transfer)", example: "Emirates NBD", sensitive: true },
  { key: "IBAN", label: "Employee's IBAN or account number", example: "AE070331234567890123456", sensitive: true },
  // Filled only on salary revision letters (Employee › Salary history).
  { key: "SALARYEFFECTIVE", label: "Salary revision: effective from", example: "01-11-2026" },
  { key: "SALARYBEFORE", label: "Salary revision: monthly salary before (AED)", example: "4,500.00" },
  { key: "SALARYAFTER", label: "Salary revision: monthly salary after (AED)", example: "5,000.00" },
  { key: "SALARYCHANGE", label: "Salary revision: change (AED)", example: "+500.00" },
  { key: "SALARYCHANGEPCT", label: "Salary revision: change (%)", example: "+11.1%" },
  { key: "SALARYREASON", label: "Salary revision: reason", example: "Annual increment" },
  // Filled only on final settlement letters (Payroll › Final settlements).
  { key: "SETTLEEXIT", label: "Settlement: last working day", example: "31-12-2026" },
  { key: "SETTLEREASON", label: "Settlement: reason for leaving", example: "Resigned" },
  { key: "SETTLEYEARS", label: "Settlement: years of service", example: "3.25" },
  { key: "SETTLEGRATUITY", label: "Settlement: gratuity (AED)", example: "4,500.00" },
  { key: "SETTLEUNPAID", label: "Settlement: salary for days worked, not yet paid (AED)", example: "1,500.00" },
  { key: "SETTLELEAVE", label: "Settlement: leave pay (AED)", example: "800.00" },
  { key: "SETTLENOTICE", label: "Settlement: notice pay (AED)", example: "0.00" },
  { key: "SETTLEOTHEREARN", label: "Settlement: other amounts due to the employee (AED)", example: "0.00" },
  { key: "SETTLELOAN", label: "Settlement: loans and advances outstanding (AED)", example: "300.00" },
  { key: "SETTLEOTHERDED", label: "Settlement: other amounts due from the employee (AED)", example: "0.00" },
  { key: "SETTLETOTALEARN", label: "Settlement: total due to the employee (AED)", example: "6,800.00" },
  { key: "SETTLETOTALDED", label: "Settlement: total deductions (AED)", example: "300.00" },
  { key: "SETTLENET", label: "Settlement: net amount (AED)", example: "6,500.00" },
  { key: "SETTLENETLABEL", label: "Settlement: net amount wording", example: "payable to the employee" },
  // Filled only on salary deduction notices (Payroll › the run's Deduction column).
  { key: "DEDUCTIONAMOUNT", label: "Deduction notice: amount (AED)", example: "50.00" },
  { key: "DEDUCTIONREASON", label: "Deduction notice: reason", example: "Damaged equipment" },
  { key: "DEDUCTIONMONTH", label: "Deduction notice: salary month", example: "October 2026" },
];

export const fieldsFor = (audience: Audience): MergeField[] => (audience === "EMPLOYEE" ? EMPLOYEE_MERGE_FIELDS : LETTER_MERGE_FIELDS);

export const knownKeys = (audience: Audience) => new Set(fieldsFor(audience).map((f) => f.key));

/** Fields in a body that aren't real (they would print blank). "Ask when issuing" prompts are fine for employee letters. */
export function unknownFieldsIn(html: string, audience: Audience): string[] {
  const known = knownKeys(audience);
  if (audience === "SITE") known.add("SPONSORSHIPCOMPANYNAME");
  return [...new Set(tokensIn(html).filter((t) => !known.has(t) && !(audience === "EMPLOYEE" && t.startsWith(ASK_PREFIX) && t.length > ASK_PREFIX.length)))];
}
