import { round2 } from "@/lib/payroll";
import type { Payslip, PayslipRow } from "@/lib/payslip";
import type { PayslipDoc } from "@/lib/payslipData";

/**
 * What a payslip shows. A line can be left off, but the payslip must still add up to the net pay, so its amount is
 * folded into "Other earnings" / "Other deductions" instead of vanishing. Totals and net never change.
 */
export const PAYSLIP_HIDEABLE: { key: string; label: string; side: "earnings" | "deductions" | "block" }[] = [
  { key: "overtime", label: "Overtime", side: "earnings" },
  { key: "allowances", label: "Allowances", side: "earnings" },
  { key: "absence", label: "Absence", side: "deductions" },
  { key: "gas", label: "Gas charge", side: "deductions" },
  { key: "bank", label: "Bank charge", side: "deductions" },
  { key: "shortHours", label: "Short-hours deduction", side: "deductions" },
  { key: "loan", label: "Loan or advance recovery", side: "deductions" },
  { key: "manual", label: "Manual deduction", side: "deductions" },
  { key: "ytd", label: "Year-to-date block", side: "block" },
];

const KNOWN = new Set(PAYSLIP_HIDEABLE.map((h) => h.key));

/** The stored comma list (or a query value) as the set of kinds to hide; anything unrecognised is dropped. */
export function parseHidden(value: string | null | undefined): string[] {
  return [...new Set((value ?? "").split(",").map((k) => k.trim()).filter((k) => KNOWN.has(k)))];
}

function fold(rows: PayslipRow[], hidden: ReadonlySet<string>, otherKey: string, otherLabel: string): PayslipRow[] {
  const keep = rows.filter((r) => !(r.key && hidden.has(r.key)));
  const gone = round2(rows.filter((r) => r.key && hidden.has(r.key)).reduce((s, r) => s + r.amount, 0));
  if (gone <= 0) return rows;
  const other = keep.find((r) => r.key === otherKey);
  if (other) return keep.map((r) => (r === other ? { ...r, amount: round2(r.amount + gone), note: undefined } : r));
  return [...keep, { label: otherLabel, amount: gone, key: otherKey }];
}

export function foldPayslip(slip: Payslip, hiddenKeys: readonly string[]): Payslip {
  const hidden = new Set(hiddenKeys);
  if (hidden.size === 0) return slip;
  return { ...slip, earnings: fold(slip.earnings, hidden, "otherEarnings", "Other earnings"), deductions: fold(slip.deductions, hidden, "otherDeductions", "Other deductions") };
}

/** A whole payslip document with the chosen kinds folded away (and the year-to-date block dropped when asked). */
export function applyPayslipView(doc: PayslipDoc, hiddenKeys: readonly string[]): PayslipDoc {
  if (hiddenKeys.length === 0) return doc;
  const noYtd = hiddenKeys.includes("ytd");
  return { ...doc, slips: doc.slips.map((s) => ({ ...s, slip: foldPayslip(s.slip, hiddenKeys), ytd: noYtd ? { ...s.ytd, months: 0 } : s.ytd })) };
}
