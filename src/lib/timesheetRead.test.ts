import test from "node:test";
import assert from "node:assert/strict";
import { cleanDayValue, cleanTimesheetRows, matchRoster } from "./timesheetRead";

test("hours, absent and days off are kept; anything else is dropped", () => {
  assert.equal(cleanDayValue(" 10 "), "10");
  assert.equal(cleanDayValue("8.5"), "8.5");
  assert.equal(cleanDayValue("10h"), "10");
  assert.equal(cleanDayValue("a"), "A");
  assert.equal(cleanDayValue("Absent"), "A");
  assert.equal(cleanDayValue("Fri"), "OFF");
  assert.equal(cleanDayValue("OFF"), "OFF");
  assert.equal(cleanDayValue("30"), "");
  assert.equal(cleanDayValue("smudge"), "");
  assert.equal(cleanDayValue(null), "");
});

test("rows are padded or cut to the month and nameless rows dropped", () => {
  const rows = cleanTimesheetRows([{ employeeIdNo: "D1", employeeName: "A", trade: "", days: ["10", "A"] }, { employeeIdNo: "", employeeName: "", days: [] }, { employeeName: "B", days: Array(40).fill("9") }], 30);
  assert.equal(rows.length, 2);
  assert.equal(rows[0].days.length, 30);
  assert.deepEqual(rows[0].days.slice(0, 3), ["10", "A", ""]);
  assert.equal(rows[1].days.length, 30);
});

test("matches by ID, else by a single exact name, never by a shared name", () => {
  const roster = [{ employeeIdNo: "DM-1", name: "Ali Khan" }, { employeeIdNo: "DM-2", name: "Sam Roy" }, { employeeIdNo: "DM-3", name: "Sam Roy" }];
  assert.equal(matchRoster({ employeeIdNo: "dm-1", employeeName: "" }, roster)?.employeeIdNo, "DM-1");
  assert.equal(matchRoster({ employeeIdNo: "", employeeName: "ALI  KHAN" }, roster)?.employeeIdNo, "DM-1");
  assert.equal(matchRoster({ employeeIdNo: "", employeeName: "Sam Roy" }, roster), null);
});
