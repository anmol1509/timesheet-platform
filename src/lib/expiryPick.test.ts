import test from "node:test";
import assert from "node:assert/strict";
import { pickExpiry } from "./expiryPick";

test("the later of issue and expiry is the expiry", () => {
  assert.equal(pickExpiry({ issue: "2025-01-21", expiry: "2027-01-20" }), "2027-01-20");
  assert.equal(pickExpiry({ issue: "2027-01-20", expiry: "2025-01-21" }), "2027-01-20");
});
test("an expiry alone is kept; garbage is dropped", () => {
  assert.equal(pickExpiry({ issue: "", expiry: "2027-03-27" }), "2027-03-27");
  assert.equal(pickExpiry({ issue: "2025-01-21", expiry: "" }), null);
  assert.equal(pickExpiry({ expiry: "27/03/2027" }), null);
});
