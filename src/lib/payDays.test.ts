import test from "node:test";
import assert from "node:assert/strict";
import { buildDays, attendanceFromCell, type DayPlan, type DayInput } from "./payDays";

const days = (n: number, over: Record<number, Partial<DayInput>> = {}): DayInput[] =>
  Array.from({ length: n }, (_, i) => ({ date: `2026-09-${String(i + 1).padStart(2, "0")}`, status: "PRESENT", normalHours: 8, otHours: 0, ts: "8", ...over[i + 1] }));
const plan = (o: Partial<DayPlan> = {}): DayPlan => ({
  from: "2026-09-01", to: "2026-09-30", days: days(30), hasTimesheet: true, pattern: { dailyHours: 8, weeklyOffDays: [5] },
  hourly: false, hourlyRate: 0, fixedPaid: 2000, paysOvertime: true, otMultiplier: 1.25, restMultiplier: 1.5, otHourlyBase: 1500 / 30 / 8, absence: { freeDays: 1, perDay: 30, dailyRate: 66.67 }, ...o,
});

test("daily salary adds up exactly to the month's fixed pay", () => {
  const { totals } = buildDays(plan({ fixedPaid: 2000.01 }));
  assert.equal(totals.salary, 2000.01);
});

test("a part month spreads pay over the days employed only", () => {
  const { rows, totals } = buildDays(plan({ from: "2026-09-20", fixedPaid: 733.33 }));
  assert.equal(rows.filter((r) => r.kind === "outside").length, 19);
  assert.equal(totals.salary, 733.33);
  assert.equal(rows[0].salary, 0);
});

test("overtime and rest-day hours are priced like the run prices them", () => {
  const rows = buildDays(plan({ days: days(30, { 3: { normalHours: 8, otHours: 2, ts: "10" }, 5: { normalHours: 6, otHours: 0, ts: "6" } }) })).rows;
  // 2h overtime on a working day; the 5th is a Saturday... weekly off is Friday (5), 2026-09-04 is a Friday
  const base = 1500 / 30 / 8;
  assert.equal(rows[2].otPay, Math.round(2 * base * 1.25 * 100) / 100);
  const friday = buildDays(plan({ days: days(30, { 4: { normalHours: 6, otHours: 0, ts: "6" } }) })).rows[3];
  assert.equal(friday.rest, 6);
  assert.equal(friday.otPay, Math.round(6 * base * 1.5 * 100) / 100);
});

test("the first free absences cost nothing, later ones the supplier's per-day amount", () => {
  const { rows, totals } = buildDays(plan({ days: days(30, { 2: { status: "ABSENT", normalHours: null, otHours: null, ts: "A" }, 9: { status: "ABSENT", normalHours: null, otHours: null, ts: "A" }, 10: { status: "ABSENT", normalHours: null, otHours: null, ts: "A" } }) }));
  assert.deepEqual([rows[1].deduction, rows[8].deduction, rows[9].deduction], [0, 30, 30]);
  assert.equal(totals.absent, 3);
  assert.equal(totals.deduction, 60);
});

test("an hourly worker is paid the timesheet hours at the hourly rate", () => {
  const { totals } = buildDays(plan({ hourly: true, hourlyRate: 12, fixedPaid: 0, days: days(30, { 1: { ts: "10" }, 2: { ts: "A" }, 3: { ts: "" } }) }));
  assert.equal(totals.salary, Math.round((10 + 27 * 8) * 12 * 100) / 100);
});

test("timesheet alignment: match, differs, and no timesheet", () => {
  const a = buildDays(plan({ days: days(30, { 6: { ts: "9" }, 7: { status: "ABSENT", normalHours: null, otHours: null, ts: "A" } }) }));
  assert.equal(a.rows[5].sync, "differs");
  assert.equal(a.rows[6].sync, "match");
  assert.equal(a.totals.mismatches, 1);
  assert.equal(buildDays(plan({ hasTimesheet: false })).rows[0].sync, "no-timesheet");
});

test("copying a timesheet cell into attendance", () => {
  assert.deepEqual(attendanceFromCell("A", 8), { status: "ABSENT", normalHours: null, otHours: null });
  assert.deepEqual(attendanceFromCell("10", 8), { status: "PRESENT", normalHours: 8, otHours: 2 });
  assert.deepEqual(attendanceFromCell("6", 8), { status: "PRESENT", normalHours: 6, otHours: 0 });
  assert.equal(attendanceFromCell("", 8), null);
  assert.equal(attendanceFromCell("??", 8), null);
});
