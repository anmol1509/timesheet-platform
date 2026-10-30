import test from "node:test";
import assert from "node:assert/strict";
import { amountOf, monthOf } from "./importer/apply/loans";

test("months are read from the ways people write them", () => {
  assert.equal(monthOf("2026-03"), "2026-03");
  assert.equal(monthOf("03/2026"), "2026-03");
  assert.equal(monthOf("Mar 2026"), "2026-03");
  assert.equal(monthOf("15/03/2026"), "2026-03");
  assert.equal(monthOf("13/2026"), null);
  assert.equal(monthOf("soon"), null);
});

test("amounts ignore AED and thousands commas, and refuse anything else", () => {
  assert.equal(amountOf("AED 1,200.50"), 1200.5);
  assert.equal(amountOf("3000"), 3000);
  assert.equal(amountOf(""), null);
  assert.equal(amountOf("abc"), null);
});
