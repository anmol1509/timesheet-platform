import test from "node:test";
import assert from "node:assert/strict";
import { clock, timeLeft } from "./progressTime";

test("elapsed time reads as minutes and seconds", () => {
  assert.equal(clock(0), "0:00");
  assert.equal(clock(65_000), "1:05");
  assert.equal(clock(3_725_000), "62:05");
});

test("time left is only given once there is enough progress to estimate", () => {
  const t0 = 1_000_000;
  assert.equal(timeLeft(t0, 1, 10, t0 + 20_000), null);
  assert.equal(timeLeft(t0, 5, 10, t0 + 4_000), null);
  assert.equal(timeLeft(t0, 10, 10, t0 + 60_000), null);
  assert.equal(timeLeft(t0, 5, 10, t0 + 30_000), "less than a minute left");
  assert.equal(timeLeft(t0, 10, 100, t0 + 60_000), "about 9 min left");
});
