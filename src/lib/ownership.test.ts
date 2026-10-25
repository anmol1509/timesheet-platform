import assert from "node:assert/strict";
import { test } from "node:test";
import { equalSplit, isValidShare, ownershipProblem, ownershipSummary } from "./ownership";

test("no owners is fine; one owner must hold 100", () => {
  assert.equal(ownershipSummary([]).ok, true);
  assert.equal(ownershipSummary([100]).ok, true);
  assert.equal(ownershipSummary([60]).ok, false);
  assert.equal(ownershipSummary([null]).ok, false);
});

test("two owners must add up to 100, not more, not less", () => {
  assert.equal(ownershipSummary([50, 50]).ok, true);
  assert.equal(ownershipSummary([51, 49]).ok, true);
  assert.equal(ownershipSummary([60, 50]).ok, false);
  assert.equal(ownershipSummary([40, 50]).ok, false);
  assert.equal(ownershipSummary([50, null]).ok, false);
});

test("the summary says what is left, and the message says what to do", () => {
  const short = ownershipSummary([60, 30]);
  assert.deepEqual([short.total, short.remaining, short.unset], [90, 10, 0]);
  assert.match(ownershipProblem(short)!, /90%, 10% short/);
  assert.match(ownershipProblem(ownershipSummary([70, 50]))!, /120%, 20% over/);
  assert.match(ownershipProblem(ownershipSummary([50, null]))!, /Choose a share/);
  assert.equal(ownershipProblem(ownershipSummary([50, 50])), null);
});

test("an equal split always adds up to 100", () => {
  assert.deepEqual(equalSplit(1), [100]);
  assert.deepEqual(equalSplit(2), [50, 50]);
  assert.deepEqual(equalSplit(3), [34, 33, 33]);
  assert.deepEqual(equalSplit(0), []);
  for (let n = 1; n <= 12; n++) assert.equal(equalSplit(n).reduce((a, b) => a + b, 0), 100, `n=${n}`);
});

test("shares are whole percentages from 1 to 100", () => {
  assert.equal(isValidShare(1), true);
  assert.equal(isValidShare(100), true);
  for (const bad of [0, 101, 33.3, -5, NaN, "50", null, undefined]) assert.equal(isValidShare(bad), false, String(bad));
});

test("ownershipIssue: own companies need an owner, others only when they list some", async () => {
  const { ownershipIssue } = await import("./ownership");
  assert.equal(ownershipIssue(true, []), "No owner added.");
  assert.equal(ownershipIssue(false, []), null);
  assert.equal(ownershipIssue(true, [100]), null);
  assert.equal(ownershipIssue(true, [60, 30]), "Owners' shares add up to 90%, 10% short of 100%.");
  assert.match(ownershipIssue(false, [50, null]) ?? "", /Choose a share/);
});
