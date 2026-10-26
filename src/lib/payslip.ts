import { round2 } from "@/lib/payroll";

/**
 * What a payslip shows, worked out once so the printed page, the PDF and the
 * employee portal can never disagree: every earning and every deduction on a
 * pay line, and totals that always come back to its net pay.
 */
export type PayslipLine = {
  payStructure: string;
  basic: number; allowances: number; overtimePay: number; deductions: number; adjustment: number; adjustmentNote: string | null;
  otherEarnings: number; otherDeductions: number; manualDeduction: number; deductionNote: string | null; deductionItems?: { label: string; amount: number; show: boolean }[] | null; loanDeduction: number; advanceNote: string | null; gasCharge: number; bankCharge?: number; shortfallHours?: number; shortfallDeduction?: number;
  absentDays: number; unpaidLeaveDays: number; otHours: number; restHours: number; normalHours: number; employedDays: number | null; daysInMonth: number; net: number;
  items?: { kind: string; label: string; amount: number }[] | null;
};
/** `key` names the kind of line, so a payslip can be told which kinds to fold away (see payslipView). */
export type PayslipRow = { label: string; amount: number; note?: string; key?: string };
export type Payslip = { earnings: PayslipRow[]; deductions: PayslipRow[]; gross: number; totalDeductions: number; net: number };

const pos = (n: number) => round2(Math.max(0, n));

export function buildPayslip(l: PayslipLine): Payslip {
  const days = l.absentDays + l.unpaidLeaveDays;
  const earnings: PayslipRow[] = [];
  const add = (rows: PayslipRow[], label: string, amount: number, note?: string, key?: string) => { if (amount > 0) rows.push({ label, amount: round2(amount), note, key }); };

  add(earnings, l.payStructure === "FLAT" ? "Monthly rate" : l.payStructure === "HOURLY" ? "Hourly pay" : "Basic salary", l.basic, l.payStructure === "HOURLY" ? `${l.normalHours} hours` : l.employedDays != null ? `${l.employedDays} of ${l.daysInMonth} days` : undefined, "basic");
  add(earnings, "Allowances", l.allowances, undefined, "allowances");
  add(earnings, "Overtime", l.overtimePay, [l.otHours > 0 ? `${l.otHours} h` : "", l.restHours > 0 ? `${l.restHours} h rest day or holiday` : ""].filter(Boolean).join(" + ") || undefined, "overtime");
  const earnItems = (l.items ?? []).filter((i) => i.kind === "EARNING");
  if (earnItems.length > 0) for (const i of earnItems) add(earnings, i.label, i.amount, undefined, "earningItem");
  else add(earnings, "Other earnings", l.otherEarnings, undefined, "otherEarnings");
  add(earnings, l.adjustmentNote || "Adjustment", pos(l.adjustment), undefined, "adjustment");

  const deductions: PayslipRow[] = [];
  add(deductions, "Absence", l.deductions, days > 0 ? `${days} day${days === 1 ? "" : "s"}` : undefined, "absence");
  add(deductions, "Gas charge", l.gasCharge, undefined, "gas");
  add(deductions, "Bank charge", l.bankCharge ?? 0, undefined, "bank");
  add(deductions, "Short hours", l.shortfallDeduction ?? 0, (l.shortfallHours ?? 0) > 0 ? `${l.shortfallHours} h short on days worked less than the standard day` : undefined, "shortHours");
  const dedItems = (l.items ?? []).filter((i) => i.kind === "DEDUCTION");
  if (dedItems.length > 0) for (const i of dedItems) add(deductions, i.label, i.amount, undefined, "deductionItem");
  else add(deductions, "Other deductions", l.otherDeductions, undefined, "otherDeductions");
  // Typed deductions are listed one by one; any left unticked for the payslip still come off, inside "Other deductions".
  const typed = (l.deductionItems ?? []).filter((i) => i.amount > 0);
  if (typed.length > 0) for (const i of typed) { if (i.show) add(deductions, i.label || "Deduction", i.amount, undefined, "manual"); }
  else add(deductions, l.deductionNote || "Deduction", l.manualDeduction, undefined, "manual");
  const tucked = round2(typed.filter((i) => !i.show).reduce((s, i) => s + i.amount, 0));
  if (tucked > 0) {
    const other = deductions.find((r) => r.key === "otherDeductions");
    if (other) other.amount = round2(other.amount + tucked);
    else deductions.push({ label: "Other deductions", amount: tucked, key: "otherDeductions" });
  }
  add(deductions, l.advanceNote || "Loan or advance recovery", l.loanDeduction, undefined, "loan");
  add(deductions, l.adjustmentNote || "Adjustment", pos(-l.adjustment), undefined, "adjustmentDeduction");

  const gross = round2(earnings.reduce((s, r) => s + r.amount, 0));
  const totalDeductions = round2(deductions.reduce((s, r) => s + r.amount, 0));
  return { earnings, deductions, gross, totalDeductions, net: round2(l.net) };
}

/** Year to date as of a run: this line and the earlier approved or paid ones from the same calendar year. */
export function yearToDate(lines: { month: string; gross: number; deductions: number; net: number }[], month: string) {
  const year = month.slice(0, 4);
  const mine = lines.filter((l) => l.month.slice(0, 4) === year && l.month <= month);
  return { gross: round2(mine.reduce((s, l) => s + l.gross, 0)), deductions: round2(mine.reduce((s, l) => s + l.deductions, 0)), net: round2(mine.reduce((s, l) => s + l.net, 0)), months: mine.length };
}
