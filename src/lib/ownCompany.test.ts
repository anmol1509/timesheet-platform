import assert from "node:assert/strict";
import { test } from "node:test";
import { ownDocIsConfidential } from "./ownCompany";

test("letterhead and workmen's compensation stay open; other company files are confidential", () => {
  assert.equal(ownDocIsConfidential("LETTERHEAD"), false);
  assert.equal(ownDocIsConfidential("WORKMEN_COMPENSATION"), false);
  assert.equal(ownDocIsConfidential("WORKMEN_COMPENSATION_INSURANCE"), false);
  for (const t of ["TRADE_LICENSE", "EJARI_TENANCY", "ESTABLISHMENT_CARD", "TRN_CERTIFICATE", "CONTRACT", "OTHER", "MADE_UP"]) assert.equal(ownDocIsConfidential(t), true, t);
});
