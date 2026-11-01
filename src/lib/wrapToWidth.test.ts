import test from "node:test";
import assert from "node:assert/strict";
import { wrapToWidth } from "./letterLayout";

test("short text is untouched", () => assert.equal(wrapToWidth("Mason", 8, 60), "Mason"));
test("words that can wrap by themselves are left alone", () => assert.equal(wrapToWidth("Gulf Skills Site Services", 8, 60), "Gulf Skills Site Services"));
test("a long unbreakable ID continues on the next line, in order, with nothing lost", () => {
  const id = "784-1998-30277041234567-4";
  const out = wrapToWidth(id, 8, 70);
  assert.ok(out.includes("\n"));
  assert.equal(out.replace(/\n/g, ""), id);
  for (const line of out.split("\n")) assert.ok(line.length * 8 * 0.6 <= 70);
});
