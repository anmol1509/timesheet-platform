import test from "node:test";
import assert from "node:assert/strict";
import { buildPayslip, type PayslipLine } from "./payslip";
import { applyPayslipView, foldPayslip, parseHidden } from "./payslipView";

const line = (o: Partial<PayslipLine> = {}): PayslipLine => ({ payStructure: "ITEMISED", basic: 1500, allowances: 500, overtimePay: 240, deductions: 0, adjustment: 0, adjustmentNote: null, otherEarnings: 0, otherDeductions: 25, manualDeduction: 0, deductionNote: null, loanDeduction: 100, advanceNote: null, gasCharge: 50, absentDays: 0, unpaidLeaveDays: 0, otHours: 0, restHours: 0, normalHours: 0, employedDays: null, daysInMonth: 30, net: 2065, ...o });

test("a hidden gas charge is folded into Other deductions, and the totals do not move", () => {
  const p = buildPayslip(line());
  const f = foldPayslip(p, ["gas"]);
  assert.ok(!f.deductions.some((r) => r.label === "Gas charge"));
  assert.equal(f.deductions.find((r) => r.key === "otherDeductions")?.amount, 75);
  assert.equal(f.totalDeductions, p.totalDeductions);
  assert.equal(f.gross, p.gross);
  assert.equal(f.net, p.net);
});

test("with no Other deductions line, one is made", () => {
  const f = foldPayslip(buildPayslip(line({ otherDeductions: 0 })), ["gas"]);
  assert.deepEqual(f.deductions.map((r) => r.label), ["Loan or advance recovery", "Other deductions"]);
  assert.equal(f.deductions.at(-1)?.amount, 50);
});

test("hiding something that is not on this payslip changes nothing", () => {
  const p = buildPayslip(line({ gasCharge: 0 }));
  assert.deepEqual(foldPayslip(p, ["gas"]), p);
});

test("hidden earnings fold into Other earnings and the payslip still adds up", () => {
  const p = buildPayslip(line());
  const f = foldPayslip(p, ["overtime"]);
  assert.ok(!f.earnings.some((r) => r.label === "Overtime"));
  assert.equal(f.earnings.reduce((s, r) => s + r.amount, 0), p.gross);
});

test("unknown kinds are ignored when read back", () => {
  assert.deepEqual(parseHidden("gas, bogus ,ytd,gas"), ["gas", "ytd"]);
  assert.deepEqual(parseHidden(null), []);
});

test("the year-to-date block can be dropped for a whole document", () => {
  const doc = { month: "2026-08", letterhead: {} as never, slips: [{ lineId: "l", employee: { name: "A", idNo: "1", role: "x", department: null }, paidBy: "Bank", slip: buildPayslip(line()), ytd: { gross: 1, deductions: 1, net: 1, months: 3 } }] };
  assert.equal(applyPayslipView(doc, ["ytd"]).slips[0].ytd.months, 0);
  assert.equal(applyPayslipView(doc, []).slips[0].ytd.months, 3);
});
