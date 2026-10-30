import test from "node:test";
import assert from "node:assert/strict";
import { payByTrade, rateForTrade } from "./tradePay";

const skills = [{ trade: "Carpenter", rate: 45 }, { trade: "Helper", rate: 35 }, { trade: "Mason", rate: null }];

test("a trade is paid at the rate on that trade, else the worker's usual rate", () => {
  assert.deepEqual(rateForTrade(skills, " carpenter ", 40), { rate: 45, fromTrade: true });
  assert.deepEqual(rateForTrade(skills, "Mason", 40), { rate: 40, fromTrade: false });
  assert.deepEqual(rateForTrade(skills, "Painter", 40), { rate: 40, fromTrade: false });
  assert.deepEqual(rateForTrade(skills, null, 40), { rate: 40, fromTrade: false });
});

test("a month split across two trades pays each at its own rate", () => {
  const r = payByTrade([{ trade: "Carpenter", hours: 96 }, { trade: "Helper", hours: 112 }], skills, 40);
  assert.equal(r.multi, true);
  assert.equal(r.hours, 208);
  assert.equal(r.pay, 96 * 45 + 112 * 35);
  assert.equal(r.lines.length, 2);
  assert.ok(Math.abs(r.blended * r.hours - r.pay) < 0.01);
});

test("one trade, or equal rates, is exactly the ordinary pay", () => {
  const one = payByTrade([{ trade: "Carpenter", hours: 200 }], skills, 40);
  assert.equal(one.multi, false);
  assert.equal(one.blended, 45);
  assert.equal(one.pay, 9000);
  const same = payByTrade([{ trade: "Painter", hours: 100 }, { trade: "Plasterer", hours: 50 }], skills, 40);
  assert.equal(same.multi, false);
  assert.equal(same.blended, 40);
  assert.equal(same.pay, 6000);
});

test("the same trade written two ways is added together, and empty hours are ignored", () => {
  const r = payByTrade([{ trade: "Carpenter", hours: 10 }, { trade: "carpenter ", hours: 5 }, { trade: "Helper", hours: 0 }], skills, 40);
  assert.equal(r.lines.length, 1);
  assert.equal(r.hours, 15);
});
