import assert from "node:assert/strict";
import { test } from "node:test";
import { buildEmployeeMonth, type MonthDayInput } from "./employeeMonth";

const day = (date: string, status: string | null, normal: number | null, ot: number | null, ts: string | null): MonthDayInput => ({ date, status, normalHours: normal, otHours: ot, ts });
const run = (days: MonthDayInput[], hasTimesheet = true) => buildEmployeeMonth({ days, hasTimesheet, from: "2026-10-01", to: "2026-10-31", weeklyOffDays: [0] });

test("attendance hours split into normal and overtime, and match the client sheet", () => {
  const { rows, totals } = run([day("2026-10-05", "PRESENT", 8, 3, "11"), day("2026-10-06", "ABSENT", null, null, "A")]);
  assert.equal(rows[0].hours, 11);
  assert.equal(rows[0].ot, 3);
  assert.equal(rows[0].sync, "match");
  assert.equal(rows[1].kind, "absent");
  assert.deepEqual([totals.workedDays, totals.hours, totals.ot, totals.absent, totals.mismatches, totals.sheetHours], [1, 11, 3, 1, 0, 11]);
});

test("a day where attendance and the sheet disagree is counted", () => {
  const { rows, totals } = run([day("2026-10-05", "PRESENT", 8, 0, "10")]);
  assert.equal(rows[0].sync, "differs");
  assert.equal(totals.mismatches, 1);
});

test("with no attendance the client sheet is read; a Sunday with nothing is a weekly off", () => {
  const { rows } = run([day("2026-10-07", null, null, null, "9"), day("2026-10-08", null, null, null, "A"), day("2026-10-11", null, null, null, ""), day("2026-10-12", null, null, null, "")]);
  assert.deepEqual(rows.map((r) => [r.kind, r.hours]), [["work", 9], ["absent", 0], ["off", 0], ["unrecorded", 0]]);
  assert.ok(rows.every((r) => r.sync === "unchecked")); // no attendance to compare with, so nothing is flagged
});

test("days before joining or after leaving are shown as not employed", () => {
  const out = buildEmployeeMonth({ days: [day("2026-10-01", null, null, null, ""), day("2026-10-20", "PRESENT", 8, 0, "8")], hasTimesheet: true, from: "2026-10-10", to: "2026-10-31", weeklyOffDays: [0] });
  assert.equal(out.rows[0].kind, "outside");
  assert.equal(out.rows[1].kind, "work");
  assert.equal(out.totals.mismatches, 0);
});

test("no timesheet means nothing to compare", () => {
  const { rows, totals } = run([day("2026-10-05", "PRESENT", 8, 0, null)], false);
  assert.equal(rows[0].sync, "unchecked");
  assert.equal(totals.mismatches, 0);
});
