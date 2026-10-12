import { round2 } from "@/lib/payroll";
import { buildPayslip, type PayslipLine } from "@/lib/payslip";

export type JournalLine = { account: string; debit: number; credit: number; costCentre: string };

/**
 * The accounting entry for a payroll run: salary expense for gross earnings, against what is owed to staff
 * (net pay), what is recovered from advances, and every other deduction. Debits always equal credits.
 */
export function buildJournal(lines: { costCentre: string; line: PayslipLine }[]): JournalLine[] {
  const by = new Map<string, { gross: number; net: number; loan: number; other: number }>();
  for (const { costCentre, line } of lines) {
    const s = buildPayslip(line);
    const loan = Math.min(s.totalDeductions, round2(line.loanDeduction));
    const row = by.get(costCentre) ?? { gross: 0, net: 0, loan: 0, other: 0 };
    row.gross = round2(row.gross + s.gross);
    row.net = round2(row.net + s.net);
    row.loan = round2(row.loan + loan);
    row.other = round2(row.other + (s.totalDeductions - loan));
    by.set(costCentre, row);
  }
  const out: JournalLine[] = [];
  for (const [costCentre, r] of by) {
    out.push({ account: "Salaries and wages expense", debit: r.gross, credit: 0, costCentre });
    out.push({ account: "Salaries payable", debit: 0, credit: r.net, costCentre });
    if (r.loan > 0) out.push({ account: "Staff loans and advances recovered", debit: 0, credit: r.loan, costCentre });
    if (r.other > 0) out.push({ account: "Payroll deductions (absence, fines, gas, other)", debit: 0, credit: r.other, costCentre });
  }
  return out;
}

export const csvCell = (v: string | number) => {
  const s = String(v);
  // Spreadsheet formula characters are neutralised so a name typed as =HYPERLINK(...) cannot run when the file is opened.
  const safe = /^[=+\-@\t\r]/.test(s) && Number.isNaN(Number(s)) ? `'${s}` : s;
  return /[",\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
};
