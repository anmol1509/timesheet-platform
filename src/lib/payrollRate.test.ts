import assert from "node:assert/strict";
import { test } from "node:test";
import { hourlyRateSource } from "./payrollRun";

const emp = (o: Record<string, unknown>) => ({ hourlyRate: null, trade: "Mason", position: null, skills: [], ...o }) as never;

test("the rate on their trade; otherwise the one saved on the employee; otherwise none", () => {
  assert.deepEqual(hourlyRateSource(emp({ hourlyRate: 6.5 })), { rate: 6.5, source: "EMPLOYEE", trade: null });
  assert.deepEqual(hourlyRateSource(emp({ skills: [{ rate: 5, isActive: true, skill: { name: "Mason" } }] })), { rate: 5, source: "TRADE", trade: "Mason" });
  assert.deepEqual(hourlyRateSource(emp({ skills: [{ rate: null, isActive: true, skill: { name: "Mason" } }] })), { rate: 0, source: "NONE", trade: null });
  assert.deepEqual(hourlyRateSource(emp({})), { rate: 0, source: "NONE", trade: null });
});

test("a rate on the worker's trade is paid before one saved on the worker", () => {
  const e = { hourlyRate: 5.3, skills: [{ rate: 6, isActive: true, skill: { name: "Painter" } }] } as Parameters<typeof hourlyRateSource>[0];
  assert.deepEqual(hourlyRateSource(e), { rate: 6, source: "TRADE", trade: "Painter" });
});

test("with several trades that carry a rate, the one named like the worker's trade is paid", () => {
  const skills = [{ rate: 7, isActive: true, skill: { name: "Painter" } }, { rate: 5, isActive: false, skill: { name: "Mason" } }, { rate: 6, isActive: false, skill: { name: "Carpenter" } }];
  assert.deepEqual(hourlyRateSource(emp({ trade: "Mason", skills })), { rate: 5, source: "TRADE", trade: "Mason" });
  // No trade matches: the active one, then the first by name, the same every time.
  assert.deepEqual(hourlyRateSource(emp({ trade: "Welder", skills })), { rate: 7, source: "TRADE", trade: "Painter" });
  assert.deepEqual(hourlyRateSource(emp({ trade: "Welder", skills: skills.map((s) => ({ ...s, isActive: false })) })), { rate: 6, source: "TRADE", trade: "Carpenter" });
  assert.deepEqual(hourlyRateSource(emp({ trade: "Welder", skills: [...skills].reverse().map((s) => ({ ...s, isActive: false })) })), { rate: 6, source: "TRADE", trade: "Carpenter" });
});
