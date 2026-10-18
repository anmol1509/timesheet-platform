/**
 * Details a letter can be missing, and what can be done about each from the letter page.
 * A fixable one is typed into the Fix dialog and saved on the employee; the rest point to the page that owns them.
 */
export type GapInput = "text" | "date" | "passport" | "eid" | "iban" | "country";

export const GAP_FIELDS: Record<string, { column: "trade" | "nationality" | "passportNumber" | "emiratesId" | "joinDate" | "wpsBankName" | "wpsIban"; input: GapInput; pay?: boolean }> = {
  DESIGNATION: { column: "trade", input: "text" },
  NATIONALITY: { column: "nationality", input: "country" },
  PASSPORTNO: { column: "passportNumber", input: "passport" },
  EMIRATESID: { column: "emiratesId", input: "eid" },
  JOINDATE: { column: "joinDate", input: "date" },
  BANKNAME: { column: "wpsBankName", input: "text", pay: true },
  IBAN: { column: "wpsIban", input: "iban", pay: true },
};

/** Where to go to fill a gap that can't be typed here. */
export function gapElsewhere(key: string): { label: string; href: (employeeId: string) => string } {
  if (key === "BASICSALARY" || key === "TOTALSALARY") return { label: "Set the pay structure on the employee's Payroll & WPS tab", href: (id) => `/employees/${id}` };
  if (key === "PROJECTNAME") return { label: "Assign a project on the employee's page", href: (id) => `/employees/${id}` };
  if (key.startsWith("ADVANCE")) return { label: "Comes from Loans & advances", href: () => "/payroll/loans" };
  if (key.startsWith("SETTLE")) return { label: "Comes from Final settlements", href: () => "/payroll/settlements" };
  if (key.startsWith("SALARY")) return { label: "Comes from the employee's salary history", href: (id) => `/employees/${id}` };
  return { label: "Add it on the employee's page", href: (id) => `/employees/${id}` };
}
