import test from "node:test";
import assert from "node:assert/strict";
import { companyNameMatches } from "./companyName";

test("legal forms and punctuation are ignored", () => {
  assert.ok(companyNameMatches("AL NOOR MANPOWER SERVICES L.L.C.", ["Al Noor Manpower Services LLC"]));
  assert.ok(companyNameMatches("Al Noor Manpower Services L.L.C", ["AL NOOR MANPOWER SERVICES"]));
  assert.ok(companyNameMatches("GULF SKILLS GENERAL CONTRACTING CO. LTD", ["Gulf Skills General Contracting"]));
});

test("an abbreviated word matches the full word", () => {
  assert.ok(companyNameMatches("ACME CONCRETE CARPENTER CONTRACTING LLC", ["Acme Concrete Carpenter Cont"]));
});

test("a longer name on the document still matches a shorter record name", () => {
  assert.ok(companyNameMatches("AL NOOR CONTRACTING AND GENERAL MAINTENANCE LLC", ["Al Noor Contracting"]));
});

test("any of the company's names may match", () => {
  assert.ok(companyNameMatches("GULF SKILLS GENERAL CONTRACTING LLC", ["GSGC", "Gulf Skills General Contracting"]));
});

test("a different company does not match, even with a shared first word", () => {
  assert.equal(companyNameMatches("AL NOOR LABOUR SUPPLY LLC", ["Al Noor Manpower Services LLC"]), false);
  assert.equal(companyNameMatches("EMIRATES STEEL TRADING LLC", ["Gulf Skills General Contracting"]), false);
});

test("a small spelling difference in a long word matches", () => {
  assert.ok(companyNameMatches("MOHAMMAD AL KHALEEJ BUILDING MATERIALS", ["Mohammed Al Khaleej Building Materials"]));
});

test("an unreadable name is never a mismatch", () => {
  assert.ok(companyNameMatches("", ["Al Noor"]));
  assert.ok(companyNameMatches(undefined, ["Al Noor"]));
  assert.ok(companyNameMatches("AL NOOR LLC", []));
});
