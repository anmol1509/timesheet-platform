import test from "node:test";
import assert from "node:assert/strict";
import { gratuity, gratuityBreakdown, yearsOfService } from "./gratuity";

test("nothing is due before one year", () => assert.equal(gratuity(3000, 0.99), 0));
test("first five years: 21 days of basic per year", () => assert.equal(gratuity(3000, 3), 6300)); // 3 x 21 x 100
test("beyond five years: 30 days per year", () => assert.equal(gratuity(3000, 7), 10500 + 6000)); // 5 x 21 x 100 + 2 x 30 x 100
test("capped at two years of basic", () => assert.equal(gratuity(3000, 30), 72000));
test("part years count pro rata", () => assert.equal(gratuity(3000, 1.5), 3150));
test("no basic, no gratuity", () => assert.equal(gratuity(0, 10), 0));
test("whole calendar years count exactly, leap years or not", () => {
  const d = (s: string) => new Date(`${s}T00:00:00.000Z`);
  assert.equal(yearsOfService(d("2020-01-01"), d("2025-01-01")), 5);
  assert.equal(yearsOfService(d("2023-01-01"), d("2026-01-01")), 3);
  assert.equal(yearsOfService(d("2022-06-15"), d("2025-06-15")), 3);
});

test("a part year is the fraction of that year served", () => {
  const d = (s: string) => new Date(`${s}T00:00:00.000Z`);
  assert.equal(yearsOfService(d("2025-01-01"), d("2025-07-02")).toFixed(2), "0.50");
  assert.equal(yearsOfService(d("2024-03-10"), d("2026-03-09")).toFixed(2), "2.00"); // a day short of two years
  assert.ok(yearsOfService(d("2024-03-10"), d("2026-03-09")) < 2);
});

test("no service before the join date", () => {
  assert.equal(yearsOfService(new Date(Date.UTC(2026, 0, 1)), new Date(Date.UTC(2025, 0, 1))), 0);
});

test("breakdown itemises the same total gratuity() returns", () => {
  const b = gratuityBreakdown(3000, 8);
  assert.equal(b.firstAmount, 10500);
  assert.equal(b.beyondAmount, 9000);
  assert.equal(b.total, gratuity(3000, 8));
  assert.equal(b.capApplied, false);
});

test("breakdown shows when the two-year cap applies, and nothing under a year", () => {
  assert.equal(gratuityBreakdown(3000, 30).capApplied, true);
  assert.equal(gratuityBreakdown(3000, 30).total, 72000);
  const none = gratuityBreakdown(3000, 0.5);
  assert.equal(none.eligible, false);
  assert.equal(none.total, 0);
});
