/** The columns of the check-in list, in print order. The number and the employee's name always print: they identify the row. */
export const CHECKIN_COLUMNS = [
  { key: "slNo", label: "No.", flex: 0.4, always: true },
  { key: "checkInNo", label: "Check-in no.", flex: 0.95, always: false },
  { key: "employeeName", label: "Employee", flex: 1.7, always: true },
  { key: "employeeCode", label: "Emp code", flex: 0.9, always: false },
  { key: "trade", label: "Trade", flex: 1.2, always: false },
  { key: "nationality", label: "Nationality", flex: 0.9, always: false },
  { key: "supplierName", label: "Company", flex: 1.5, always: false },
  { key: "coordinator", label: "Coordinator", flex: 1.2, always: false },
  { key: "status", label: "Status", flex: 0.95, always: false },
] as const;

export type CheckInColumnKey = (typeof CHECKIN_COLUMNS)[number]["key"];

/** Every column: what the list has always printed. */
export const ALL_CHECKIN_COLUMNS: CheckInColumnKey[] = CHECKIN_COLUMNS.map((c) => c.key);

/** The columns to print from a comma-separated list; the always-on ones are added, unknown keys are dropped, and nothing chosen means all. */
export function checkInColumnsFrom(text: string | null | undefined): CheckInColumnKey[] {
  const wanted = new Set((text ?? "").split(",").map((s) => s.trim()).filter(Boolean));
  if (wanted.size === 0) return ALL_CHECKIN_COLUMNS;
  return CHECKIN_COLUMNS.filter((c) => c.always || wanted.has(c.key)).map((c) => c.key);
}
