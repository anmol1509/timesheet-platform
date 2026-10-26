import assert from "node:assert/strict";
import { test } from "node:test";
import { formatSheetNo } from "./sheetNo";

test("timesheet numbers read TS-year-0001 and grow past four digits", () => {
  assert.equal(formatSheetNo(2026, 1), "TS-2026-0001");
  assert.equal(formatSheetNo(2026, 42), "TS-2026-0042");
  assert.equal(formatSheetNo(2027, 12345), "TS-2027-12345");
});
