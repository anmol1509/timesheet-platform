import test from "node:test";
import assert from "node:assert/strict";
import { ALL_CHECKIN_COLUMNS, checkInColumnsFrom } from "./checkInColumns";

test("no choice prints every column, as the list always has", () => {
  assert.deepEqual(checkInColumnsFrom(""), ALL_CHECKIN_COLUMNS);
  assert.deepEqual(checkInColumnsFrom(null), ALL_CHECKIN_COLUMNS);
});

test("a choice keeps the number and name, drops unknown keys, and keeps print order", () => {
  assert.deepEqual(checkInColumnsFrom("status,trade,bogus"), ["slNo", "employeeName", "trade", "status"]);
  assert.deepEqual(checkInColumnsFrom("nationality"), ["slNo", "employeeName", "nationality"]);
});
