import test from "node:test";
import assert from "node:assert/strict";
import { scanVerdict } from "./renewalScan";

test("no file filed", () => assert.deepEqual(scanVerdict("2024-01-03T00:00:00.000Z", null), { kind: "none" }));
test("a file with no date can't confirm anything", () => assert.deepEqual(scanVerdict("2024-01-03T00:00:00.000Z", { id: "d1", expiry: null }), { kind: "undated", id: "d1" }));
test("the same day agrees, whatever the time of day", () => assert.equal(scanVerdict("2027-03-27T00:00:00.000Z", { id: "d1", expiry: "2027-03-27T20:00:00.000Z" }).kind, "agrees"));
test("a different day is flagged with the file's date", () => {
  const v = scanVerdict("2025-03-12T00:00:00.000Z", { id: "d1", expiry: "2035-01-25T00:00:00.000Z" });
  assert.deepEqual(v, { kind: "differs", id: "d1", scanExpiry: "2035-01-25T00:00:00.000Z" });
});
