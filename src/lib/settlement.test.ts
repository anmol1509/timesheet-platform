import test from "node:test";
import assert from "node:assert/strict";
import { computeSettlement, unpaidDaysDefault } from "./settlement";

const d = (s: string) => new Date(`${s}T00:00:00.000Z`);
const base = { basicMonthly: 3000, fixedMonthly: 4500, joinDate: d("2023-01-01"), exitDate: d("2026-01-01"), unpaidSalaryDays: 0, leavePay: 0, noticePay: 0, otherEarnings: 0, loanBalance: 0, otherDeductions: 0 };

test("three years of service: 21 days of basic per year", () => {
  const r = computeSettlement(base);
  assert.equal(r.serviceYears, 3);
  assert.equal(r.gratuity, 6300);
  assert.equal(r.net, 6300);
});

test("unpaid days are worth one thirtieth of the monthly pay each", () => {
  const r = computeSettlement({ ...base, unpaidSalaryDays: 10 });
  assert.equal(r.unpaidSalary, 1500);
  assert.equal(r.net, 7800);
});

test("leave and notice pay add, loans and other dues take off", () => {
  const r = computeSettlement({ ...base, leavePay: 800, noticePay: 1000, otherEarnings: 200, loanBalance: 1500, otherDeductions: 300 });
  assert.equal(r.earnings, 6300 + 800 + 1000 + 200);
  assert.equal(r.deductions, 1800);
  assert.equal(r.net, 6500);
});

test("under a year there is no gratuity", () => {
  assert.equal(computeSettlement({ ...base, joinDate: d("2025-09-01") }).gratuity, 0);
});

test("a worker who owes more than they are owed gets a negative figure, not zero", () => {
  const r = computeSettlement({ ...base, joinDate: d("2025-12-01"), loanBalance: 2000 });
  assert.equal(r.net, -2000);
});

test("negative or nonsense amounts are ignored rather than reversing the sign", () => {
  const r = computeSettlement({ ...base, leavePay: -500, noticePay: Number.NaN, otherDeductions: -100 });
  assert.equal(r.net, 6300);
});

test("no join date means no service and no gratuity", () => {
  assert.equal(computeSettlement({ ...base, joinDate: null }).gratuity, 0);
});

test("days not covered by a payroll run default to the exit date's day of month", () => {
  assert.equal(unpaidDaysDefault(d("2026-03-12"), false), 12);
  assert.equal(unpaidDaysDefault(d("2026-03-12"), true), 0);
  assert.equal(unpaidDaysDefault(d("2026-03-31"), false), 30);
});
