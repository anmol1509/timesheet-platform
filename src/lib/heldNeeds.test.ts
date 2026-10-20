import test from "node:test";
import assert from "node:assert/strict";
import { needsFor, remainingOn } from "./heldNeeds";

const lines = [
  { requestId: "a", requestNo: 4, trade: "Mason", remaining: 3 },
  { requestId: "b", requestNo: 5, trade: "Painter", remaining: 2 },
  { requestId: "c", requestNo: 6, trade: "mason ", remaining: 0 },
  { requestId: "d", requestNo: 7, trade: "MASON", remaining: 1 },
];

test("only lines still short of heads, in the trades the held workers hold", () => {
  const n = needsFor(["Mason"], lines);
  assert.deepEqual(n.map((x) => x.requestNo), [4, 7]);
});
test("no held trades means no needs, and the list is capped", () => {
  assert.deepEqual(needsFor([], lines), []);
  assert.equal(needsFor(["Mason", "Painter"], lines, 2).length, 2);
});
test("remaining uses the agreed quantity, or the asked one while undecided, and never goes negative", () => {
  assert.equal(remainingOn({ quantity: 10, approvedQuantity: 6 }, 2), 4);
  assert.equal(remainingOn({ quantity: 10, approvedQuantity: null }, 2), 8);
  assert.equal(remainingOn({ quantity: 10, approvedQuantity: 0 }, 0), 0);
  assert.equal(remainingOn({ quantity: 4, approvedQuantity: 4 }, 6), 0);
});
