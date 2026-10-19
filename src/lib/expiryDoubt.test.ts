import test from "node:test";
import assert from "node:assert/strict";
import { expiryDoubt } from "./expiryDoubt";

const today = "2026-10-19";

test("a past expiry is flagged, a current one is not", () => {
  assert.match(expiryDoubt("VISA", "2025-01-21", today) ?? "", /already expired/);
  assert.equal(expiryDoubt("VISA", "2027-01-20", today), null);
});
test("a date further ahead than the document type allows is flagged", () => {
  assert.match(expiryDoubt("MEDICAL", "2030-01-01", today) ?? "", /too far ahead/);
  assert.match(expiryDoubt("EMIRATES_ID", "2040-03-27", today) ?? "", /too far ahead/);
  assert.equal(expiryDoubt("PASSPORT", "2035-01-25", today), null);
});
test("no date, a bad date or a type with no limit is left alone", () => {
  assert.equal(expiryDoubt("VISA", "", today), null);
  assert.equal(expiryDoubt("VISA", null, today), null);
  assert.equal(expiryDoubt("OTHER", "2050-01-01", today), null);
  assert.equal(expiryDoubt("VISA", "27/03/2027", today), null);
});
