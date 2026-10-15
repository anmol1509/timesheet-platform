import test from "node:test";
import assert from "node:assert/strict";
import { hourlyRate, type RateInput } from "./ratePricing";

// The worked example in /blog/how-to-price-manpower-supply-uae-hourly-rate.
const example: RateInput = {
  salaryAndAllowances: 1500, visaAndPermits: 120, accommodation: 200, transport: 150,
  foodAndConsumables: 100, gratuityProvision: 100, leaveAndTicketProvision: 100,
  overheadPct: 10, marginPct: 15, paidHours: 208, unbilledPct: 0,
};

test("matches the blog's worked example", () => {
  const r = hourlyRate(example);
  assert.equal(r.direct, 2270);
  assert.equal(r.overhead, 227);
  assert.equal(r.totalCost, 2497);
  assert.equal(r.margin, 374.55);
  assert.equal(r.monthlyPrice, 2871.55);
  assert.equal(r.rate, 13.81);
});

test("8% unbilled hours raises the rate to 15.01", () => {
  const r = hourlyRate({ ...example, unbilledPct: 8 });
  assert.equal(r.rate, 15.01);
  assert.equal(r.rateOnPaidHours, 13.81);
});

test("empty or invalid input gives no rate rather than NaN or Infinity", () => {
  assert.equal(hourlyRate({ ...example, paidHours: 0 }).rate, 0);
  assert.equal(hourlyRate({ ...example, salaryAndAllowances: NaN, visaAndPermits: 0, accommodation: 0, transport: 0, foodAndConsumables: 0, gratuityProvision: 0, leaveAndTicketProvision: 0 }).rate, 0);
  assert.equal(hourlyRate({ ...example, unbilledPct: 100 }).rate > 0, true); // clamped, never divides by zero
});
