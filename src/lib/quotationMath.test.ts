import test from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_QUOTE_SETTINGS as S, defaultCostParts, isByUs, lineProfit, monthlyEach, parseAdjustments, quoteProfit, quoteTotals } from "./quotationMath";

test("converts day and hour prices to a month", () => {
    assert.equal(monthlyEach({ quantity: 1, rate: 95, unit: "DAY" }, S), 95 * 26);
    assert.ok(Math.abs((monthlyEach({ quantity: 1, rate: 8.5, unit: "HOUR", hoursPerDay: 10 }, S)) - (8.5 * 10 * 26)) < 1e-6);
    assert.equal(monthlyEach({ quantity: 1, rate: 40, unit: "CUSTOM", unitsPerMonth: 30 }, S), 1200);
    assert.equal(monthlyEach({ quantity: 1, rate: 1850 }, S), 1850);
});

test("applies discount, then charge, then tax; nothing unless chosen", () => {
    const lines = [{ quantity: 10, rate: 100 }];
    assert.equal(quoteTotals(lines, [], S).total, 1000);
    const t = quoteTotals(lines, parseAdjustments([
      { kind: "TAX", name: "VAT", mode: "PERCENT", value: 5 },
      { kind: "DISCOUNT", name: "Volume", mode: "PERCENT", value: 10 },
      { kind: "CHARGE", name: "Mobilisation", mode: "FIXED", value: 100 },
    ]), S);
    assert.equal(t.subtotal, 1000);
    assert.ok(Math.abs((t.total) - ((1000 - 100 + 100) * 1.05)) < 1e-6);
});

test("drops malformed adjustments", () => {
    assert.deepEqual(parseAdjustments([{ kind: "TAX", name: "", mode: "PERCENT", value: 5 }, { kind: "X" }, null, "a"]), []);
});

test("contract total needs every line to have a duration", () => {
    assert.equal(quoteTotals([{ quantity: 2, rate: 100, durationMonths: 12 }], [], S).contractSubtotal, 2400);
    assert.equal(quoteTotals([{ quantity: 2, rate: 100, durationMonths: 12 }, { quantity: 1, rate: 50 }], [], S).contractSubtotal, null);
});

test("profit per worker per month, and below-cost flag", () => {
    const l = { quantity: 47, rate: 1850, costPerMonth: 1485 };
    assert.equal(lineProfit(l, S)?.each, 365);
    assert.equal(lineProfit({ quantity: 1, rate: 8.5, unit: "HOUR", costPerMonth: 2300 }, S)?.belowCost, true);
    assert.equal(lineProfit({ quantity: 1, rate: 100 }, S), null);
    const q = quoteProfit([l, { quantity: 1, rate: 100 }], S);
    assert.equal(q.perMonth, 365 * 47);
    assert.equal(q.skipped, 1);
});

test("adds shared costs only when the terms say by us", () => {
    const s = { ...S, costDefaults: { permits: 120, accommodation: 150, transport: 100, ppe: 15, food: 0 } };
    assert.equal(isByUs("By us"), true);
    assert.equal(isByUs("Provided by client"), false);
    const parts = defaultCostParts({ salary: 1100, accommodation: "Provided by client", transport: "By us", ppe: "By us" }, s);
    assert.deepEqual(parts.map((p) => p.label), ["Salary and allowances", "Visa, labour card, medical", "Transport", "PPE"]);
  });