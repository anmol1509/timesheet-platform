import test from "node:test";
import assert from "node:assert/strict";
import { deductionValues, revisionValues, settlementValues } from "./payrollDocValues";
import { LETTER_PRESETS, presetByKey, presetHtml } from "./letterPresets";
import { unknownFieldsIn } from "./letterFields";

test("a salary revision shows the change and the percentage", () => {
  const v = revisionValues({ effectiveFrom: "2026-10-01", fixedBefore: 4000, fixedAfter: 4400, reason: "Annual review" });
  assert.equal(v.SALARYEFFECTIVE, "01-10-2026");
  assert.equal(v.SALARYBEFORE, "4,000.00");
  assert.equal(v.SALARYAFTER, "4,400.00");
  assert.equal(v.SALARYCHANGE, "+400.00");
  assert.equal(v.SALARYCHANGEPCT, "+10.0%");
  assert.equal(v.SALARYREASON, "Annual review");
});

test("a pay cut is shown with a minus, and a zero starting pay has no percentage", () => {
  assert.equal(revisionValues({ effectiveFrom: "2026-10-01", fixedBefore: 5000, fixedAfter: 4500, reason: null }).SALARYCHANGE, "−500.00");
  assert.equal(revisionValues({ effectiveFrom: "2026-10-01", fixedBefore: 0, fixedAfter: 3000, reason: null }).SALARYCHANGEPCT, "");
});

test("a settlement adds up what is owed and what is taken off", () => {
  const v = settlementValues({ exitDate: "2026-10-31", reason: "Resigned", serviceYears: 3.5, gratuity: 2000, unpaidSalary: 1000, leavePay: 500, noticePay: 0, otherEarnings: 100, loanBalance: 300, otherDeductions: 50, net: 3250 });
  assert.equal(v.SETTLETOTALEARN, "3,600.00");
  assert.equal(v.SETTLETOTALDED, "350.00");
  assert.equal(v.SETTLENET, "3,250.00");
  assert.equal(v.SETTLENETLABEL, "payable to the employee");
  assert.equal(v.SETTLEEXIT, "31-10-2026");
});

test("a settlement where the employee owes more than they are owed says so", () => {
  const v = settlementValues({ exitDate: "2026-10-31", reason: null, serviceYears: 0.5, gratuity: 0, unpaidSalary: 200, leavePay: 0, noticePay: 0, otherEarnings: 0, loanBalance: 900, otherDeductions: 0, net: -700 });
  assert.equal(v.SETTLENET, "700.00");
  assert.equal(v.SETTLENETLABEL, "due from the employee");
});

test("a deduction notice names the month", () => {
  const v = deductionValues({ amount: 50, reason: "Damaged helmet", month: "2026-10" });
  assert.deepEqual(v, { DEDUCTIONAMOUNT: "50.00", DEDUCTIONREASON: "Damaged helmet", DEDUCTIONMONTH: "October 2026" });
});

test("the four payroll letter presets exist and only use known fields", () => {
  for (const key of ["salary-revision", "final-settlement", "deduction-notice", "salary-transfer-letter"]) {
    const p = presetByKey(key);
    assert.ok(p, key);
    assert.deepEqual(unknownFieldsIn(presetHtml(p!), "EMPLOYEE"), [], key);
  }
  assert.ok(LETTER_PRESETS.length > 4);
});
