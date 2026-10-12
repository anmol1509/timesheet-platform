/**
 * The merge-field values for the letters that come from payroll records: a salary revision, a final settlement
 * statement and a salary deduction notice. Worked out from plain facts, so the wording can be tested without a
 * database. Dates arrive as YYYY-MM-DD and print as DD-MM-YYYY, like every other letter.
 */
const money = (n: number) => n.toLocaleString("en-AE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const date = (iso: string | null) => (iso ? iso.split("-").reverse().join("-") : "");
const monthName = (m: string) => new Date(`${m}-01T00:00:00Z`).toLocaleDateString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" });
const signed = (n: number) => `${n >= 0 ? "+" : "−"}${money(Math.abs(n))}`;

export function revisionValues(f: { effectiveFrom: string; fixedBefore: number; fixedAfter: number; reason: string | null }): Record<string, string> {
  const change = Math.round((f.fixedAfter - f.fixedBefore) * 100) / 100;
  const pct = f.fixedBefore > 0 ? (change / f.fixedBefore) * 100 : null;
  return {
    SALARYEFFECTIVE: date(f.effectiveFrom),
    SALARYBEFORE: money(f.fixedBefore),
    SALARYAFTER: money(f.fixedAfter),
    SALARYCHANGE: signed(change),
    SALARYCHANGEPCT: pct === null ? "" : `${pct >= 0 ? "+" : "−"}${Math.abs(pct).toFixed(1)}%`,
    SALARYREASON: f.reason ?? "",
  };
}

export type SettlementFacts = {
  exitDate: string; reason: string | null; serviceYears: number;
  gratuity: number; unpaidSalary: number; leavePay: number; noticePay: number; otherEarnings: number; loanBalance: number; otherDeductions: number; net: number;
};

export function settlementValues(f: SettlementFacts): Record<string, string> {
  const earned = Math.round((f.gratuity + f.unpaidSalary + f.leavePay + f.noticePay + f.otherEarnings) * 100) / 100;
  const deducted = Math.round((f.loanBalance + f.otherDeductions) * 100) / 100;
  return {
    SETTLEEXIT: date(f.exitDate),
    SETTLEREASON: f.reason ?? "",
    SETTLEYEARS: f.serviceYears.toFixed(2),
    SETTLEGRATUITY: money(f.gratuity),
    SETTLEUNPAID: money(f.unpaidSalary),
    SETTLELEAVE: money(f.leavePay),
    SETTLENOTICE: money(f.noticePay),
    SETTLEOTHEREARN: money(f.otherEarnings),
    SETTLELOAN: money(f.loanBalance),
    SETTLEOTHERDED: money(f.otherDeductions),
    SETTLETOTALEARN: money(earned),
    SETTLETOTALDED: money(deducted),
    SETTLENET: money(Math.abs(f.net)),
    SETTLENETLABEL: f.net < 0 ? "due from the employee" : "payable to the employee",
  };
}

export function deductionValues(f: { amount: number; reason: string | null; month: string }): Record<string, string> {
  return { DEDUCTIONAMOUNT: money(f.amount), DEDUCTIONREASON: f.reason ?? "", DEDUCTIONMONTH: monthName(f.month) };
}
