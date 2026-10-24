import assert from "node:assert/strict";
import { test } from "node:test";
import { companyHeaderFields, companyPrintedName, headerGaps, type CompanyHeaderSource } from "./issuerHeader";

const full: CompanyHeaderSource = { name: "Gulf Skills", fullName: "GULF SKILLS GENERAL CONTRACTING LLC", location: "Office 12, Al Quoz", emirate: "Dubai", country: "UAE", phone: "+971 4 111 2222", contactEmail: "accounts@gulfskills.ae", poBox: "P.O. Box 5566", trn: "100123456700003", logoId: "img1" };

test("the header uses the company's own details and its logo, strictly", () => {
  const f = companyHeaderFields(full);
  assert.equal(f.name, "GULF SKILLS GENERAL CONTRACTING LLC");
  assert.equal(f.address, "Office 12, Al Quoz");
  assert.equal(f.trn, "100123456700003");
  assert.equal(f.logoId, "img1");
  assert.equal(f.strictLogo, true);
  assert.equal(f.fax, null);
});

test("the printed name falls back to the short name when there is no full name", () => {
  assert.equal(companyPrintedName({ name: "Gulf Skills", fullName: "  " }), "Gulf Skills");
  assert.equal(companyPrintedName({ name: "Gulf Skills", fullName: null }), "Gulf Skills");
});

test("blank fields stay blank, never borrowed", () => {
  const f = companyHeaderFields({ ...full, trn: "  ", location: "", logoId: null, phone: null });
  assert.equal(f.trn, null);
  assert.equal(f.address, null);
  assert.equal(f.phone, null);
  assert.equal(f.logoId, null);
});

test("gaps name what is missing", () => {
  assert.deepEqual(headerGaps(full), []);
  assert.deepEqual(headerGaps({ ...full, logoId: null, trn: null }), ["logo", "TRN"]);
  assert.deepEqual(headerGaps({ ...full, location: " ", phone: null, contactEmail: null }), ["address", "phone", "email"]);
});
