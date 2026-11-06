import test from "node:test";
import assert from "node:assert/strict";
import { effectiveLicenceExpiry } from "./licenceExpiry";

const d = (s: string) => new Date(s + "T00:00:00Z");

test("a renewed licence file beats the supplier's stale date", () => {
  assert.equal(effectiveLicenceExpiry(d("2026-11-04"), d("2027-11-04"))?.toISOString().slice(0, 10), "2027-11-04");
});
test("a date typed on the supplier beats an older file", () => {
  assert.equal(effectiveLicenceExpiry(d("2028-01-01"), d("2027-11-04"))?.toISOString().slice(0, 10), "2028-01-01");
});
test("either alone is used, and none gives null", () => {
  assert.equal(effectiveLicenceExpiry(null, d("2027-01-01"))?.toISOString().slice(0, 10), "2027-01-01");
  assert.equal(effectiveLicenceExpiry(d("2027-02-02"), undefined)?.toISOString().slice(0, 10), "2027-02-02");
  assert.equal(effectiveLicenceExpiry(null, undefined), null);
});
