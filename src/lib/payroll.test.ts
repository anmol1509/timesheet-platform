import test from "node:test";
import assert from "node:assert/strict";
import {
  capToAvailable, computePay, employmentWindow, gasChargeFor, monthBounds, netPayWithExtras, planLoanRecovery, proratedFixed, round2, splitDayHours, wpsGaps, appliesToMonth, shortDayWorked, shortfallDay, shortfallTotal,
  type PayProfile,
} from "./payroll";

const base: PayProfile = { payStructure: "ITEMISED", basic: 1500, housing: 300, food: 200, transport: 0, other: 0, flat: 0, hourly: 0, paysOvertime: true, otMultiplier: 1.25 };
const facts = { normalHours: 0, absentDays: 0, unpaidLeaveDays: 0, otHours: 0 };

test("a full month pays basic plus allowances", () => {
  const r = computePay(base, facts);
  assert.deepEqual(r, { basic: 1500, allowances: 500, fixed: 2000, deductions: 0, overtimePay: 0 });
});

test("overtime is paid on basic only: basic / 30 / 8 times the multiplier", () => {
  const r = computePay(base, { ...facts, otHours: 10 });
  assert.equal(r.overtimePay, round2(10 * (1500 / 30 / 8) * 1.25)); // 78.13
});

test("absence: the free days cost nothing, then the per-day amount", () => {
  const rule = { ...base, absenceFreeDays: 2, absencePerDay: 30 };
  assert.equal(computePay(rule, { ...facts, absentDays: 2 }).deductions, 0);
  assert.equal(computePay(rule, { ...facts, absentDays: 5 }).deductions, 90);
});

test("without a company rule an absent day costs one thirtieth of pay", () => {
  assert.equal(computePay(base, { ...facts, absentDays: 3 }).deductions, 200);
});

test("deductions can never exceed pay", () => {
  const r = computePay({ ...base, absenceFreeDays: 0, absencePerDay: 5000 }, { ...facts, absentDays: 3 });
  assert.equal(r.deductions, r.fixed);
});

test("flat rate: the flat figure is the basic and there are no allowances", () => {
  const r = computePay({ ...base, payStructure: "FLAT", flat: 3000 }, facts);
  assert.deepEqual([r.basic, r.allowances, r.fixed], [3000, 0, 3000]);
});

test("hourly pay is hours times rate", () => {
  const r = computePay({ ...base, payStructure: "HOURLY", hourly: 12.5 }, { ...facts, normalHours: 200 });
  assert.equal(r.fixed, 2500);
});

test("joiners and leavers: pay is one thirtieth per day employed", () => {
  assert.equal(proratedFixed(3000, 10, 31), 1000);
  assert.equal(proratedFixed(3000, 31, 31), 3000);
  assert.equal(proratedFixed(3000, 28, 28), 3000, "a whole February is a whole month");
  assert.equal(proratedFixed(3000, 29, 31), 2900);
  assert.equal(proratedFixed(3000, undefined, undefined), 3000);
  assert.equal(proratedFixed(3000, 0, 30), 0);
});

test("a partial month scales basic and allowances together and they still add up", () => {
  const r = computePay(base, { ...facts, employedDays: 10, daysInMonth: 30 });
  assert.equal(r.fixed, round2(2000 / 30 * 10));
  assert.equal(round2(r.basic + r.allowances), r.fixed);
  assert.equal(r.basic, 500);
});

test("overtime rate stays that of the full month for a part-month worker", () => {
  const full = computePay(base, { ...facts, otHours: 8 });
  const part = computePay(base, { ...facts, otHours: 8, employedDays: 10, daysInMonth: 30 });
  assert.equal(part.overtimePay, full.overtimePay);
});

test("employment window: join in the month, exit in the month, both, neither", () => {
  const m = monthBounds("2026-09")!;
  const d = (s: string) => new Date(`${s}T00:00:00.000Z`);
  assert.equal(employmentWindow(m, d("2026-09-21"), null)!.days, 10);
  assert.equal(employmentWindow(m, d("2025-01-01"), d("2026-09-15"))!.days, 15);
  assert.equal(employmentWindow(m, d("2026-09-10"), d("2026-09-19"))!.days, 10);
  assert.equal(employmentWindow(m, d("2025-01-01"), null)!.partial, false);
  assert.equal(employmentWindow(m, d("2026-10-01"), null), null, "joins next month");
  assert.equal(employmentWindow(m, d("2025-01-01"), d("2026-08-31")), null, "left last month");
  assert.equal(employmentWindow(m, null, null)!.days, 30);
  assert.equal(employmentWindow(m, d("2025-01-01"), d("2026-09-30"))!.partial, false, "leaving on the last day is a full month");
});

test("gas: per day from check-in, capped, nothing when waived or before check-in", () => {
  const monthStart = new Date(Date.UTC(2026, 8, 1));
  const o = { monthStart, daysInMonth: 30, perDay: 1, cap: 30, waived: false };
  assert.equal(gasChargeFor({ ...o, checkIn: new Date(Date.UTC(2026, 8, 21)) }), 10);
  assert.equal(gasChargeFor({ ...o, checkIn: new Date(Date.UTC(2026, 0, 1)) }), 30);
  assert.equal(gasChargeFor({ ...o, checkIn: new Date(Date.UTC(2026, 9, 5)) }), 0);
  assert.equal(gasChargeFor({ ...o, checkIn: null }), 0);
  assert.equal(gasChargeFor({ ...o, checkIn: new Date(Date.UTC(2026, 0, 1)), waived: true }), 0);
  assert.equal(gasChargeFor({ ...o, checkIn: new Date(Date.UTC(2026, 0, 1)), perDay: 5, cap: 100 }), 100);
});

test("day hours split into normal, overtime and rest-day", () => {
  const pattern = { dailyHours: 8, weeklyOffDays: [5] };
  const mon = new Date(Date.UTC(2026, 8, 7)), fri = new Date(Date.UTC(2026, 8, 4));
  assert.deepEqual(splitDayHours({ date: mon, status: "PRESENT", normalHours: 8, otHours: 3 }, pattern), { normal: 8, ot: 3, rest: 0 });
  assert.deepEqual(splitDayHours({ date: fri, status: "PRESENT", normalHours: 8, otHours: 0 }, pattern), { normal: 0, ot: 0, rest: 8 });
  assert.deepEqual(splitDayHours({ date: mon, status: "ABSENT", normalHours: 8, otHours: 0 }, pattern), { normal: 0, ot: 0, rest: 0 });
});

test("loan recovery never goes past the instalment, the balance or what net pay can bear", () => {
  const loans = [{ id: "a", remaining: 100, instalment: 300 }, { id: "b", remaining: 1000, instalment: 200 }];
  assert.deepEqual(planLoanRecovery(loans, 1000), [{ loanId: "a", amount: 100 }, { loanId: "b", amount: 200 }]);
  assert.deepEqual(planLoanRecovery(loans, 150), [{ loanId: "a", amount: 100 }, { loanId: "b", amount: 50 }]);
  assert.deepEqual(planLoanRecovery(loans, 0), []);
});

test("typed deductions are capped to the pay available", () => {
  assert.equal(capToAvailable(500, 300), 300);
  assert.equal(capToAvailable(-5, 300), 0);
  assert.equal(capToAvailable(100, 300), 100);
});

test("net pay adds earnings and takes every deduction off", () => {
  const r = computePay(base, { ...facts, otHours: 10 });
  const net = netPayWithExtras(r, 50, { otherEarnings: 100, otherDeductions: 20, loanDeduction: 200, manualDeduction: 30, gasCharge: 10 });
  assert.equal(net, round2(2000 + r.overtimePay + 50 + 100 - 20 - 200 - 30 - 10));
});

test("standing items apply from their start month to their end month", () => {
  assert.equal(appliesToMonth({ startMonth: "2026-03", endMonth: null }, "2026-09"), true);
  assert.equal(appliesToMonth({ startMonth: "2026-03", endMonth: "2026-06" }, "2026-09"), false);
  assert.equal(appliesToMonth({ startMonth: "2026-10", endMonth: null }, "2026-09"), false);
});

test("WPS gaps name what is missing; cash workers need nothing", () => {
  assert.deepEqual(wpsGaps({ paymentMode: "Cash", personCode: null, routingCode: null, account: null }), []);
  assert.deepEqual(wpsGaps({ paymentMode: "Bank", personCode: null, routingCode: "123", account: null }), ["MOL person code", "9-digit bank routing code", "IBAN / account number"]);
  assert.deepEqual(wpsGaps({ paymentMode: "Bank", personCode: "12345678901234", routingCode: "123456789", account: "AE070331234567890123456" }), []);
});

test("month bounds reject nonsense and count days", () => {
  assert.equal(monthBounds("2026-13"), null);
  assert.equal(monthBounds("nope"), null);
  assert.equal(monthBounds("2028-02")!.days, 29);
  assert.equal(monthBounds("2026-02")!.days, 28);
});

import { needsSeparateApprover } from "./payrollControls";
test("approver separation: a limit decides when set; otherwise whenever someone else can approve", () => {
  assert.equal(needsSeparateApprover(10000, 5000, true), false);
  assert.equal(needsSeparateApprover(10000, 15000, false), true);
  assert.equal(needsSeparateApprover(null, 500, true), true);
  assert.equal(needsSeparateApprover(null, 500, false), false);
});

// Short hours. Rates for the demo worker: basic 3,000, fixed 4,500: hourly 12.50, day 150.
const rates = { hourly: 12.5, day: 150 };
const sat = (d: string) => new Date(`${d}T00:00:00Z`);
const pattern = { dailyHours: 8, weeklyOffDays: [5] };

test("short hours: only a present working day under the standard counts", () => {
  assert.equal(shortDayWorked({ date: sat("2026-09-10"), status: "PRESENT", normalHours: 5, otHours: 0 }, pattern), 5);
  assert.equal(shortDayWorked({ date: sat("2026-09-10"), status: "PRESENT", normalHours: 8, otHours: 0 }, pattern), null); // a full day
  assert.equal(shortDayWorked({ date: sat("2026-09-10"), status: "PRESENT", normalHours: 6, otHours: 3 }, pattern), null); // overtime made it a long day
  assert.equal(shortDayWorked({ date: sat("2026-09-10"), status: "PRESENT", normalHours: 0, otHours: 0 }, pattern), null); // nothing recorded
  assert.equal(shortDayWorked({ date: sat("2026-09-10"), status: "ABSENT", normalHours: 5, otHours: 0 }, pattern), null);
  assert.equal(shortDayWorked({ date: sat("2026-09-10"), status: "SICK_LEAVE", normalHours: 5, otHours: 0 }, pattern), null);
  assert.equal(shortDayWorked({ date: sat("2026-09-25"), status: "PRESENT", normalHours: 5, otHours: 0 }, pattern), null); // a Friday, the weekly off
  assert.equal(shortDayWorked({ date: sat("2026-09-10"), status: "HOLIDAY", normalHours: 5, otHours: 0 }, pattern), null);
});

test("short hours, hourly rule: the missing hours at the overtime hourly rate", () => {
  const r = shortfallDay({ mode: "HOURLY", halfDayUnder: 4 }, 8, 5, null, rates);
  assert.deepEqual(r, { hours: 3, suggested: 37.5, counted: true });
});

test("short hours, half day rule: half a day only when under the threshold", () => {
  const rule = { mode: "HALF_DAY" as const, halfDayUnder: 4 };
  assert.deepEqual(shortfallDay(rule, 8, 3, null, rates), { hours: 5, suggested: 75, counted: true });
  assert.deepEqual(shortfallDay(rule, 8, 6, null, rates), { hours: 2, suggested: 0, counted: false }); // above the threshold: nothing
});

test("short hours: off takes nothing, and the day's own choice wins", () => {
  assert.equal(shortfallDay({ mode: "OFF", halfDayUnder: 4 }, 8, 5, true, rates).counted, false);
  assert.equal(shortfallDay({ mode: "HOURLY", halfDayUnder: 4 }, 8, 5, false, rates).counted, false);
  assert.equal(shortfallDay({ mode: "HOURLY", halfDayUnder: 4 }, 8, 5, null, rates).counted, true);
});

test("short hours: the total adds up only the days that count", () => {
  const days = [{ worked: 5, override: null }, { worked: 6, override: null }, { worked: 7, override: false }];
  assert.deepEqual(shortfallTotal({ mode: "HOURLY", halfDayUnder: 4 }, 8, days, rates), { hours: 5, amount: 62.5 });
});

test("net pay takes the short-hours deduction off", () => {
  const r = computePay(base, facts);
  const x = { otherEarnings: 0, otherDeductions: 0, loanDeduction: 0 };
  assert.equal(netPayWithExtras(r, 0, { ...x, shortfall: 25 }), netPayWithExtras(r, 0, x) - 25);
});
