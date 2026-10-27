import { test } from "node:test";
import assert from "node:assert/strict";
import { nameFromFile, otherDocFilename, otherDocProblem, trackedExpiry } from "./otherDoc";

test("the typed name keeps the file's extension", () => {
  assert.equal(otherDocFilename("Fire safety certificate", "scan0001.pdf"), "Fire safety certificate.pdf");
  assert.equal(otherDocFilename("Fire safety.PDF", "scan0001.pdf"), "Fire safety.PDF");
  assert.equal(otherDocFilename("  Offer   letter ", "x.jpg"), "Offer letter.jpg");
});

test("no typed name falls back to the file's own name", () => {
  assert.equal(otherDocFilename("   ", "scan0001.pdf"), "scan0001.pdf");
});

test("a name is cut to 100 characters", () => {
  assert.ok(otherDocFilename("a".repeat(300), "x.pdf").length <= 104);
});

test("an expiry is kept only when it is tracked", () => {
  assert.equal(trackedExpiry(true, "2027-05-01"), "2027-05-01");
  assert.equal(trackedExpiry(false, "2027-05-01"), "");
  assert.equal(trackedExpiry(true, ""), "");
  assert.equal(trackedExpiry(true, "01/05/2027"), "");
});

test("ticking Track expiry needs a date, and a name is always needed", () => {
  assert.equal(otherDocProblem("Licence", true, ""), "Add the expiry date, or untick Track expiry.");
  assert.equal(otherDocProblem("Licence", false, ""), null);
  assert.equal(otherDocProblem("Licence", true, "2027-05-01"), null);
  assert.equal(otherDocProblem("  ", false, ""), "Give the document a name.");
});

test("a default name comes from the file name", () => {
  assert.equal(nameFromFile("Offer_letter_2026.pdf"), "Offer letter 2026");
});
