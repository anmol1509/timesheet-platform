import test from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_PLAIN, clampMargin, marginsOfBranch, mmToPt } from "./paperMargins";

test("standard margins apply where none were saved", () => {
  assert.deepEqual(marginsOfBranch(null).plain, DEFAULT_PLAIN);
  assert.deepEqual(marginsOfBranch({}).letterheadSides, { left: 18, right: 18 });
});

test("saved margins are used as they are", () => {
  const m = marginsOfBranch({ plainTopMm: 30, plainBottomMm: 20, plainLeftMm: 22, plainRightMm: 28, letterheadLeftMm: 12, letterheadRightMm: 14 });
  assert.deepEqual(m.plain, { top: 30, bottom: 20, left: 22, right: 28 });
  assert.deepEqual(m.letterheadSides, { left: 12, right: 14 });
});

test("a margin is rounded and kept within its limits", () => {
  assert.equal(clampMargin("24.6", 10, 60), 25);
  assert.equal(clampMargin(3, 10, 60), 10);
  assert.equal(clampMargin(200, 10, 60), 60);
  assert.equal(clampMargin("abc", 10, 60), null);
});

test("millimetres convert to PDF points", () => {
  assert.equal(Math.round(mmToPt(25.4)), 72);
});
