import test from "node:test";
import assert from "node:assert/strict";
import { buildJournal, csvCell } from "./payrollReports";
import { dueDateFor, dueState, arrearsFor } from "./payrollSchedule";
import type { PayslipLine } from "./payslip";

const line = (o: Partial<PayslipLine> = {}): PayslipLine => ({ payStructure: "ITEMISED", basic: 1500, allowances: 500, overtimePay: 0, deductions: 0, adjustment: 0, adjustmentNote: null, otherEarnings: 0, otherDeductions: 0, manualDeduction: 0, deductionNote: null, loanDeduction: 0, advanceNote: null, gasCharge: 0, absentDays: 0, unpaidLeaveDays: 0, otHours: 0, restHours: 0, normalHours: 0, employedDays: null, daysInMonth: 30, net: 2000, ...o });

test("the journal balances, per cost centre and overall", () => {
  const rows = buildJournal([
    { costCentre: "P1", line: line({ deductions: 100, gasCharge: 20, loanDeduction: 200, net: 1680 }) },
    { costCentre: "P1", line: line({ overtimePay: 300, net: 2300 }) },
    { costCentre: "P2", line: line({ manualDeduction: 50, net: 1950 }) },
  ]);
  const sum = (f: (r: (typeof rows)[number]) => number) => Math.round(rows.reduce((s, r) => s + f(r), 0) * 100) / 100;
  assert.equal(sum((r) => r.debit), sum((r) => r.credit));
  for (const cc of ["P1", "P2"]) {
    const mine = rows.filter((r) => r.costCentre === cc);
    assert.equal(Math.round(mine.reduce((s, r) => s + r.debit - r.credit, 0) * 100), 0);
  }
  assert.equal(rows.find((r) => r.costCentre === "P1" && r.account.startsWith("Staff loans"))?.credit, 200);
});

test("due date is month end plus grace days; no rule means no due date", () => {
  assert.equal(dueDateFor("2026-09", 15)?.toISOString().slice(0, 10), "2026-10-15");
  assert.equal(dueDateFor("2026-02", 0)?.toISOString().slice(0, 10), "2026-02-28");
  assert.equal(dueDateFor("2026-09", null), null);
});

test("due state counts days late and days left", () => {
  const due = new Date("2026-10-15T00:00:00Z");
  assert.deepEqual({ o: dueState(due, new Date("2026-10-18T10:00:00Z")).overdue, d: dueState(due, new Date("2026-10-18T10:00:00Z")).daysLate }, { o: true, d: 3 });
  assert.equal(dueState(due, new Date("2026-10-15T23:00:00Z")).overdue, false);
  assert.equal(dueState(due, new Date("2026-10-10T00:00:00Z")).daysLeft, 5);
});

test("arrears cover each closed month from the effective date", () => {
  const a = arrearsFor(200, new Date("2026-07-01T00:00:00Z"), ["2026-06", "2026-07", "2026-08", "2026-09"]);
  assert.deepEqual(a, { months: ["2026-07", "2026-08", "2026-09"], amount: 600 });
  assert.equal(arrearsFor(200, new Date("2026-07-15T00:00:00Z"), ["2026-07", "2026-08"]).amount, 200);
});

test("csv cells are quoted and formulas neutralised", () => {
  assert.equal(csvCell('A, "B"'), '"A, ""B"""');
  assert.equal(csvCell("=1+1"), "'=1+1");
  assert.equal(csvCell(-5), "-5");
});
