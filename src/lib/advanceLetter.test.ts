import test from "node:test";
import assert from "node:assert/strict";
import { advanceLetterValues, type AdvanceFacts } from "./advanceLetter";
import { LETTER_PRESETS, presetByKey, presetHtml } from "./letterPresets";
import { unknownFieldsIn } from "./letterFields";
import { substituteInHtml, tokensIn } from "./letterHtml";

const facts: AdvanceFacts = {
  ref: "ADV-0007", kind: "Advance", amount: 1500, reason: "Family emergency", requestedOn: "2026-10-01", requestedBy: "HR Department",
  approval: { status: "APPROVED", by: "Admin", on: "2026-10-02" },
  given: { date: "2026-10-03", method: "CASH", reference: "VCH-221" },
  plan: [{ month: "2026-11", amount: 500 }, { month: "2026-12", amount: 1000 }],
  balance: 1500,
};

test("advance letter values read the way a letter writes them", () => {
  const v = advanceLetterValues(facts);
  assert.equal(v.ADVANCEAMOUNT, "1,500.00");
  assert.equal(v.ADVANCEWORDS, "One thousand five hundred dirhams only");
  assert.equal(v.ADVANCEGIVEN, "03-10-2026");
  assert.equal(v.ADVANCEPAYMENT, "cash, ref VCH-221");
  assert.equal(v.ADVANCEAPPROVAL, "Approved by Admin on 02-10-2026");
  assert.equal(v.ADVANCEPLAN, "November 2026: AED 500.00; December 2026: AED 1,000.00");
  assert.equal(v.ADVANCETYPE, "advance");
  assert.equal(advanceLetterValues({ ...facts, kind: "Loan" }).ADVANCETYPE, "loan");
});

test("before it is approved and given, the letter says so rather than leaving a gap", () => {
  const v = advanceLetterValues({ ...facts, approval: { status: "PENDING", by: null, on: null }, given: null });
  assert.equal(v.ADVANCEAPPROVAL, "Awaiting approval");
  assert.equal(v.ADVANCEGIVEN, "not yet handed over");
  assert.equal(v.ADVANCEPAYMENT, "");
  assert.equal(advanceLetterValues({ ...facts, approval: { status: "REJECTED", by: "Admin", on: "2026-10-02" } }).ADVANCEAPPROVAL, "Not approved");
});

test("the built-in advance templates only use fields that exist, and fill completely", () => {
  const advance = LETTER_PRESETS.filter((p) => p.category === "Advance Letter");
  assert.deepEqual(advance.map((p) => p.key).sort(), ["advance-receipt", "advance-request"]);
  for (const p of advance) {
    assert.deepEqual(unknownFieldsIn(presetHtml(p), p.audience), [], p.key);
    // Everything the wording needs is available: a person's details plus the advance fields.
    const values = { EMPLOYEENAME: "RAVI", EMPLOYEEID: "X1", DESIGNATION: "Carpenter", COMPANYNAME: "DEMO", ...advanceLetterValues(facts) };
    const filled = substituteInHtml(presetHtml(p), values);
    assert.equal(tokensIn(filled).length, 0, p.key);
    assert.match(filled, /Employee acknowledgement/);
  }
});

test("every built-in letter template still uses only known fields", () => {
  for (const p of LETTER_PRESETS) assert.deepEqual(unknownFieldsIn(presetHtml(p), p.audience), [], p.key);
  assert.ok(presetByKey("advance-receipt"));
});
