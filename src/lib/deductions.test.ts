import assert from "node:assert/strict";
import { test } from "node:test";
import { DEFAULT_CLIENT_ABSENCE_RULE, calculateAbsentDeduction, clientAbsenceRule, startingAbsentDeduction } from "./deductions";

test("a client's terms: two days off are free, then AED 25 each", () => {
  assert.deepEqual(DEFAULT_CLIENT_ABSENCE_RULE, { freeDays: 2, perDay: 25 });
  assert.equal(calculateAbsentDeduction(2, DEFAULT_CLIENT_ABSENCE_RULE), 0);
  assert.equal(calculateAbsentDeduction(5, DEFAULT_CLIENT_ABSENCE_RULE), 75);
});

test("a sheet with no client uses the default; a client's own terms win", () => {
  assert.deepEqual(clientAbsenceRule(null), { freeDays: 2, perDay: 25 });
  assert.deepEqual(clientAbsenceRule({ absentFreeDays: 1, absentDeductionPerDay: "40.00" }), { freeDays: 1, perDay: 40 });
});

test("a saved figure that is just the supplier's old rule moves to the client's terms; a typed-in one stays", () => {
  const supplier = { freeDays: 2, perDay: 30 };
  const client = { freeDays: 2, perDay: 25 };
  assert.equal(startingAbsentDeduction(90, 5, supplier, client), 75); // 3 days x 30 was the old calculation
  assert.equal(startingAbsentDeduction(40, 5, supplier, client), 40); // someone typed 40
  assert.equal(startingAbsentDeduction(0, 1, supplier, client), 0);
});
