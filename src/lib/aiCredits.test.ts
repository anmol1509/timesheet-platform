import { test } from "node:test";
import assert from "node:assert/strict";
import { creditStatus, creditsFor, modelWeight, monthKey, monthRange, warningDue } from "./aiCredits";

test("a credit is 1,000 input tokens, with output counted five times", () => {
  assert.equal(creditsFor("claude-haiku-4-5-20251001", 3000, 200), 4);
  assert.equal(creditsFor("claude-haiku-4-5-20251001", 1000, 0), 1);
  assert.equal(creditsFor("claude-haiku-4-5-20251001", 0, 200), 1);
});

test("a bigger model counts for more, an unknown one as the standard", () => {
  assert.equal(modelWeight("claude-sonnet-5-5"), 3);
  assert.equal(modelWeight("claude-opus-5-5"), 5);
  assert.equal(modelWeight("something-else"), 1);
  assert.equal(creditsFor("claude-sonnet-5-5", 1000, 0), 3);
});

test("a real call never costs nothing, an empty one does", () => {
  assert.equal(creditsFor("claude-haiku-4-5", 1, 0), 0.01);
  assert.equal(creditsFor("claude-haiku-4-5", 0, 0), 0);
});

test("the month turns over at UAE midnight", () => {
  assert.equal(monthKey(new Date("2026-10-31T19:59:00Z")), "2026-10");
  assert.equal(monthKey(new Date("2026-10-31T20:00:00Z")), "2026-11");
  const r = monthRange("2026-11");
  assert.equal(r.start.toISOString(), "2026-10-31T20:00:00.000Z");
  assert.equal(r.end.toISOString(), "2026-11-30T20:00:00.000Z");
  assert.equal(monthRange("2026-12").end.toISOString(), "2026-12-31T20:00:00.000Z");
});

test("the level is ok, then warn from 80%, then out", () => {
  const now = new Date("2026-10-27T10:00:00Z");
  assert.equal(creditStatus({ allowance: 1000, granted: 0, used: 799, now }).level, "ok");
  assert.equal(creditStatus({ allowance: 1000, granted: 0, used: 800, now }).level, "warn");
  const out = creditStatus({ allowance: 1000, granted: 0, used: 1000, now });
  assert.equal(out.level, "out");
  assert.equal(out.remaining, 0);
  assert.equal(out.pct, 100);
});

test("granted credits add to the month's total", () => {
  const s = creditStatus({ allowance: 1000, granted: 500, used: 1200, now: new Date("2026-10-27T10:00:00Z") });
  assert.equal(s.total, 1500);
  assert.equal(s.remaining, 300);
  assert.equal(s.level, "warn");
});

test("no allowance at all means out", () => {
  assert.equal(creditStatus({ allowance: 0, granted: 0, used: 0 }).level, "out");
});

test("a warning goes out once per step per month", () => {
  const now = new Date("2026-10-27T10:00:00Z");
  const warn = creditStatus({ allowance: 100, granted: 0, used: 85, now });
  const out = creditStatus({ allowance: 100, granted: 0, used: 100, now });
  assert.equal(warningDue(warn, { month: null, level: 0 }), 80);
  assert.equal(warningDue(warn, { month: "2026-10", level: 80 }), null);
  assert.equal(warningDue(out, { month: "2026-10", level: 80 }), 100);
  assert.equal(warningDue(out, { month: "2026-10", level: 100 }), null);
  // A new month starts again.
  assert.equal(warningDue(warn, { month: "2026-09", level: 100 }), 80);
  assert.equal(warningDue(creditStatus({ allowance: 100, granted: 0, used: 10, now }), { month: null, level: 0 }), null);
});
