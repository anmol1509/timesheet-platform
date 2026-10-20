import test from "node:test";
import assert from "node:assert/strict";
import { pathMatches } from "./navMatch";

test("a plain pattern matches itself and what is below it", () => {
  assert.equal(pathMatches("/demand/mobilisation", "/demand/mobilisation"), true);
  assert.equal(pathMatches("/demand/mobilisation/x", "/demand/mobilisation"), true);
  assert.equal(pathMatches("/demand/mobilisations", "/demand/mobilisation"), false);
});
test("a * stands for one segment such as an id", () => {
  assert.equal(pathMatches("/demand/abc/mobilise", "/demand/*/mobilise"), true);
  assert.equal(pathMatches("/demand/abc/mobilise/deeper", "/demand/*/mobilise"), true);
  assert.equal(pathMatches("/demand/abc", "/demand/*/mobilise"), false);
  assert.equal(pathMatches("/demand", "/demand/*"), false);
  assert.equal(pathMatches("/demand/", "/demand/*"), false);
  assert.equal(pathMatches("/demand/abc", "/demand/*"), true);
});
