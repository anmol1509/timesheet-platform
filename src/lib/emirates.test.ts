import test from "node:test";
import assert from "node:assert/strict";
import { UAE_EMIRATES, searchEmirates } from "./emirates";

test("there are exactly seven emirates", () => {
  assert.equal(UAE_EMIRATES.length, 7);
  assert.equal(searchEmirates("").length, 7);
});

test("typing narrows the list, matching from the start first", () => {
  assert.deepEqual(searchEmirates("sha"), ["Sharjah"]);
  assert.deepEqual(searchEmirates("RAS"), ["Ras Al Khaimah"]);
  assert.deepEqual(searchEmirates("al "), ["Umm Al Quwain", "Ras Al Khaimah"]);
  assert.deepEqual(searchEmirates("zzz"), []);
});
