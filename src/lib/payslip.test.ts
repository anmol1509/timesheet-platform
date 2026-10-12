import test from "node:test";
import assert from "node:assert/strict";
import { buildPayslip, yearToDate, type PayslipLine } from "./payslip";
import { netPayWithExtras, round2 } from "./payroll";

const line = (o: Partial<PayslipLine> = {}): PayslipLine => ({ payStructure: "ITEMISED", basic: 1500, allowances: 500, overtimePay: 0, deductions: 0, adjustment: 0, adjustmentNote: null, otherEarnings: 0, otherDeductions: 0, manualDeduction: 0, deductionNote: null, loanDeduction: 0, advanceNote: null, gasCharge: 0, absentDays: 0, unpaidLeaveDays: 0, otHours: 0, restHours: 0, normalHours: 0, employedDays: null, daysInMonth: 30, net: 2000, ...o });

test("a plain month: two earnings, nothing taken off", () => {
  const p = buildPayslip(line());
  assert.deepEqual(p.earnings.map((r) => r.label), ["Basic salary", "Allowances"]);
  assert.equal(p.deductions.length, 0);
  assert.equal(p.gross, 2000);
  assert.equal(p.net, 2000);
});

test("gross minus deductions always equals net, whatever is on the line", () => {
  let seed = 7; const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  for (let i = 0; i < 300; i++) {
    const r = (max: number) => round2(rnd() * max);
    const l = line({ basic: r(4000) + 100, allowances: r(1500), overtimePay: r(600), deductions: 0, otherEarnings: r(300), otherDeductions: r(150), manualDeduction: r(120), loanDeduction: r(200), gasCharge: r(30), adjustment: round2(rnd() * 400 - 200) });
    l.deductions = Math.min(l.basic + l.allowances, r(250));
    l.net = netPayWithExtras({ basic: l.basic, allowances: l.allowances, fixed: round2(l.basic + l.allowances), deductions: l.deductions, overtimePay: l.overtimePay }, l.adjustment, { otherEarnings: l.otherEarnings, otherDeductions: l.otherDeductions, loanDeduction: l.loanDeduction, manualDeduction: l.manualDeduction, gasCharge: l.gasCharge });
    const p = buildPayslip(l);
    assert.equal(round2(p.gross - p.totalDeductions), p.net, `line ${i}`);
  }
});

test("a negative adjustment is a deduction and a positive one an earning", () => {
  const up = buildPayslip(line({ adjustment: 100, adjustmentNote: "Bonus", net: 2100 }));
  assert.ok(up.earnings.some((r) => r.label === "Bonus" && r.amount === 100));
  const down = buildPayslip(line({ adjustment: -75, adjustmentNote: "Correction", net: 1925 }));
  assert.ok(down.deductions.some((r) => r.label === "Correction" && r.amount === 75));
});

test("a part month says how many days were paid", () => {
  const p = buildPayslip(line({ employedDays: 11, daysInMonth: 31, basic: 500, allowances: 233.33, net: 733.33 }));
  assert.equal(p.earnings[0].note, "11 of 31 days");
});

test("listed pay items replace the lump sums", () => {
  const p = buildPayslip(line({ otherEarnings: 150, otherDeductions: 50, net: 2100, items: [{ kind: "EARNING", label: "Phone allowance", amount: 100 }, { kind: "EARNING", label: "Bonus", amount: 50 }, { kind: "DEDUCTION", label: "Uniform", amount: 50 }] }));
  assert.deepEqual(p.earnings.map((r) => r.label), ["Basic salary", "Allowances", "Phone allowance", "Bonus"]);
  assert.deepEqual(p.deductions.map((r) => r.label), ["Uniform"]);
  assert.equal(round2(p.gross - p.totalDeductions), 2100);
});

test("year to date adds this year's earlier months and ignores other years", () => {
  const rows = [
    { month: "2025-12", gross: 2000, deductions: 0, net: 2000 },
    { month: "2026-01", gross: 2000, deductions: 100, net: 1900 },
    { month: "2026-02", gross: 2100, deductions: 0, net: 2100 },
    { month: "2026-03", gross: 2000, deductions: 50, net: 1950 },
  ];
  assert.deepEqual(yearToDate(rows, "2026-02"), { gross: 4100, deductions: 100, net: 4000, months: 2 });
  assert.equal(yearToDate(rows, "2026-03").net, 5950);
});
