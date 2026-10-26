import assert from "node:assert/strict";
import { test } from "node:test";
import { resolveDocTypes } from "./documentTypes";
import { candidateDocStatus } from "./candidateDocs";
import { COST_KINDS, costPerJoinedHire, costTotals, parseAmount } from "./candidateCosts";

const types = resolveDocTypes([], "CANDIDATE");
const NOW = Date.UTC(2026, 9, 25);
const file = (docType: string, expiry: string | null = null) => ({ id: docType, docType, filename: `${docType}.pdf`, expiryDate: expiry, uploadedAt: "2026-10-01T00:00:00Z" });

test("passport and photo are required; an expired passport counts as missing", () => {
  assert.deepEqual(candidateDocStatus(types, [], NOW), { have: 0, required: 2, missing: ["Passport copy", "Passport-size photo"] });
  assert.equal(candidateDocStatus(types, [file("PASSPORT", "2027-05-01T00:00:00Z"), file("PHOTO")], NOW).missing.length, 0);
  assert.deepEqual(candidateDocStatus(types, [file("PASSPORT", "2026-01-01T00:00:00Z"), file("PHOTO")], NOW).missing, ["Passport copy"]);
});

test("a branch can turn a required candidate document off", () => {
  const custom = resolveDocTypes([{ appliesTo: "CANDIDATE", key: "PHOTO", label: "Photo", hasExpiry: false, required: "NO", reminderDays: [], sortOrder: 1, isActive: true }], "CANDIDATE");
  assert.equal(candidateDocStatus(custom, [], NOW).required, 1);
});

test("costs add up by kind, paid and outstanding; cost per joined hire", () => {
  const t = costTotals([{ kind: "AGENCY_FEE", amount: 1500.5, paid: true }, { kind: "VISA", amount: 2000, paid: false }, { kind: "VISA", amount: 0.25, paid: false }]);
  assert.deepEqual(t, { total: 3500.75, paid: 1500.5, outstanding: 2000.25, byKind: { AGENCY_FEE: 1500.5, VISA: 2000.25 } });
  assert.equal(costPerJoinedHire(3500.75, 2), 1750.38);
  assert.equal(costPerJoinedHire(100, 0), null);
  assert.ok(COST_KINDS.length >= 5);
});

test("amounts typed on a form", () => {
  assert.equal(parseAmount("1,250.505"), 1250.51);
  assert.equal(parseAmount("0"), null);
  assert.equal(parseAmount("-5"), null);
  assert.equal(parseAmount("abc"), null);
});
