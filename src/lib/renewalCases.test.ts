import test from "node:test";
import assert from "node:assert/strict";
import { renewalKey, renewalStatusLabel } from "./renewalCases";

test("a renewal is named by whose it is, the document and the date it runs out", () => {
  const a = renewalKey({ kind: "employee", subjectId: "e1", document: "Visa", expiry: "2026-10-18T00:00:00.000Z" });
  assert.equal(a, "employee|e1|Visa|2026-10-18");
  // The time of day never changes the key, so the same date always finds the same case.
  assert.equal(renewalKey({ kind: "employee", subjectId: "e1", document: "Visa", expiry: "2026-10-18T09:30:00.000Z" }), a);
});

test("a renewed document, with a later expiry, is a different renewal", () => {
  const old = renewalKey({ kind: "employee", subjectId: "e1", document: "Visa", expiry: "2026-10-18T00:00:00.000Z" });
  const renewed = renewalKey({ kind: "employee", subjectId: "e1", document: "Visa", expiry: "2028-10-18T00:00:00.000Z" });
  assert.notEqual(old, renewed);
});

test("an employee and a supplier with the same id are different renewals", () => {
  const e = renewalKey({ kind: "employee", subjectId: "x", document: "Visa", expiry: "2026-10-18" });
  const s = renewalKey({ kind: "supplier", subjectId: "x", document: "Visa", expiry: "2026-10-18" });
  assert.notEqual(e, s);
});

test("statuses read as words", () => {
  assert.equal(renewalStatusLabel("IN_PROGRESS"), "In progress");
  assert.equal(renewalStatusLabel("DONE"), "Done");
});
