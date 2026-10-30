import test from "node:test";
import assert from "node:assert/strict";
import { isEmployeeComplete } from "./employeeCompleteness";

const typed = { passportNumber: "P123", emiratesId: "784-1999-1234567-1", nationality: "India", dateOfBirth: new Date("1990-01-01") };

test("typed numbers without any scan are not a complete profile", () => {
  assert.equal(isEmployeeComplete({ ...typed, documents: [] }), false);
});

test("one scan is not enough: the passport and the Emirates ID each need a file", () => {
  assert.equal(isEmployeeComplete({ ...typed, documents: [{ type: "VISA" }] }), false);
  assert.equal(isEmployeeComplete({ ...typed, documents: [{ type: "PASSPORT" }] }), false);
  assert.equal(isEmployeeComplete({ ...typed, documents: [{ type: "EMIRATES_ID" }, { type: "VISA" }] }), false);
});

test("both files and every detail make it complete", () => {
  assert.equal(isEmployeeComplete({ ...typed, documents: [{ type: "PASSPORT" }, { type: "EMIRATES_ID" }] }), true);
  assert.equal(isEmployeeComplete({ ...typed, nationality: null, documents: [{ type: "PASSPORT" }, { type: "EMIRATES_ID" }] }), false);
});
