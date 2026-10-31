import test from "node:test";
import assert from "node:assert/strict";
import { mergeTradeNames } from "./tradeNames";
import { TRADES } from "./trades";

test("the built-in trades come first and unchanged, then the added ones A to Z", () => {
  const r = mergeTradeNames(["Grc Fitter", "Carpenter", "Furnicher Carpenter"]);
  assert.deepEqual(r.slice(0, TRADES.length), [...TRADES]);
  assert.deepEqual(r.slice(TRADES.length), ["Carpenter", "Furnicher Carpenter", "Grc Fitter"]);
});

test("a name that matches a built-in one, or another added one, is not listed twice", () => {
  const r = mergeTradeNames(["helper", "  Tile   Mason ", "Grc Fitter", "GRC fitter", ""]);
  assert.equal(r.filter((t) => t.toLowerCase() === "helper").length, 1);
  assert.equal(r.filter((t) => t.toLowerCase().replace(/\s+/g, " ") === "tile mason").length, 1);
  assert.equal(r.filter((t) => t.toLowerCase() === "grc fitter").length, 1);
  assert.equal(r.length, TRADES.length + 1);
});

test("with nothing added it is the built-in list", () => {
  assert.deepEqual(mergeTradeNames([]), [...TRADES]);
});
