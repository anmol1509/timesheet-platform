import { test } from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_RATES, buildCostReport, claudeCostUsd, emailSignal, parseRates, watchSignals } from "./ownerCosts";

test("Claude cost uses the model family's price per million tokens", () => {
  assert.equal(claudeCostUsd([{ model: "claude-sonnet-5-5", input: 1_000_000, output: 1_000_000 }], DEFAULT_RATES), 12);
  assert.equal(claudeCostUsd([{ model: "claude-haiku-5-5", input: 1_000_000, output: 1_000_000 }], DEFAULT_RATES), 0.6);
  assert.equal(claudeCostUsd([{ model: "claude-haiku-4-5-20251001", input: 1_000_000, output: 1_000_000 }], DEFAULT_RATES), 6);
  assert.equal(claudeCostUsd(undefined, DEFAULT_RATES), 0);
});

test("an unknown model is priced like the dearest one", () => {
  assert.equal(claudeCostUsd([{ model: "mystery", input: 1_000_000, output: 0 }], DEFAULT_RATES), 10);
});

test("rates saved before Haiku 5.5 existed still price it at its own rate", () => {
  const r = parseRates({ models: [{ family: "haiku", inputUsd: 1, outputUsd: 5 }, { family: "sonnet", inputUsd: 3, outputUsd: 15 }] });
  assert.equal(claudeCostUsd([{ model: "claude-haiku-5-5", input: 1_000_000, output: 0 }], r), 0.1);
  assert.equal(claudeCostUsd([{ model: "claude-haiku-4-5-20251001", input: 1_000_000, output: 0 }], r), 1);
  assert.equal(claudeCostUsd([{ model: "claude-sonnet-5-5", input: 1_000_000, output: 0 }], r), 3);
});

test("bad stored settings fall back to the defaults", () => {
  const r = parseRates({ usdToAed: -3, vercelSeats: "x", customerComputeUsd: { rkg: 15 } });
  assert.equal(r.usdToAed, 3.67);
  assert.equal(r.vercelSeats, 1);
  assert.equal(r.customerComputeUsd.RKG, 15);
});

test("costs add up, the compute credit comes off, and shared costs are split equally", () => {
  const rep = buildCostReport(
    [
      { code: "RKG", name: "RKG", revenueAed: 1000, stats: null },
      { code: "BURJ", name: "Burj", revenueAed: 0, stats: null },
    ],
    { ...DEFAULT_RATES, usdToAed: 4, supabasePlanUsd: 25, supabaseComputeCreditUsd: 10, vercelSeatUsd: 20, vercelSeats: 1 },
  );
  // Supabase plan 100 - credit 40 = 60; compute 40 + 40; Vercel 80.
  assert.equal(rep.totalAed, 60 + 80 + 80);
  assert.equal(rep.marginAed, 1000 - 220);
  assert.equal(rep.perCustomer[0].shareAed, (60 + 80) / 2);
});

test("signals warn before things run out and stay quiet when figures are missing", () => {
  const s = watchSignals({ dbBytes: 7.5 * 1024 ** 3, connections: { now: 10, max: 60 } }, DEFAULT_RATES);
  assert.equal(s.database?.level, "bad");
  assert.equal(s.connections?.level, "ok");
  assert.equal(s.aiCredits, null);
  assert.equal(watchSignals({ aiLeftPct: 15 }, DEFAULT_RATES).aiCredits?.level, "warn");
  assert.equal(emailSignal(2500, DEFAULT_RATES).level, "warn");
});
