import test from "node:test";
import assert from "node:assert/strict";
import { nextCode } from "./nextCode";

test("starts at 1 when there are none", () => {
  assert.equal(nextCode("PRJ", 3, []), "PRJ001");
  assert.equal(nextCode("QTN-", 6, []), "QTN-000001");
});

test("goes one past the highest, even when numbers have gaps (Burj has PRJ004 to PRJ014 with only 7 projects)", () => {
  const burj = ["PRJ006", "PRJ014", "PRJ005", "PRJ007", "PRJ008", "PRJ009", "PRJ004"];
  assert.equal(nextCode("PRJ", 3, burj), "PRJ015");
});

test("ignores codes that do not follow the series and grows past the padding", () => {
  assert.equal(nextCode("PRJ", 3, ["PRJ-OLD", "X5", null, "PRJ999"]), "PRJ1000");
  assert.equal(nextCode("INV-", 6, ["INV-000009", "INV-000010"]), "INV-000011");
});
