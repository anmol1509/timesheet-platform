import test from "node:test";
import assert from "node:assert/strict";
import { gratuity, yearsOfService } from "./gratuity";

test("nothing is due before one year", () => assert.equal(gratuity(3000, 0.99), 0));
test("first five years: 21 days of basic per year", () => assert.equal(gratuity(3000, 3), 6300)); // 3 x 21 x 100
test("beyond five years: 30 days per year", () => assert.equal(gratuity(3000, 7), 10500 + 6000)); // 5 x 21 x 100 + 2 x 30 x 100
test("capped at two years of basic", () => assert.equal(gratuity(3000, 30), 72000));
test("part years count pro rata", () => assert.equal(gratuity(3000, 1.5), 3150));
test("no basic, no gratuity", () => assert.equal(gratuity(0, 10), 0));
test("service is measured in years from the join date", () => {
  const y = yearsOfService(new Date(Date.UTC(2020, 0, 1)), new Date(Date.UTC(2025, 0, 1)));
  assert.ok(y > 4.99 && y < 5.01);
  assert.equal(yearsOfService(new Date(Date.UTC(2026, 0, 1)), new Date(Date.UTC(2025, 0, 1))), 0);
});
