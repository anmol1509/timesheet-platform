import test from "node:test";
import assert from "node:assert/strict";
import { LETTER_MERGE_FIELDS as LETTER_MERGE_FIELDS_FOR_TEST } from "./letterLayout";
import { EMPLOYEE_MERGE_FIELDS, fieldGroup, groupedFields } from "./letterFields";

test("fields fall under readable headings", () => {
  assert.equal(fieldGroup("ADVANCEAMOUNT"), "Advance or loan");
  assert.equal(fieldGroup("SETTLENET"), "Final settlement");
  assert.equal(fieldGroup("DEDUCTIONREASON"), "Salary deduction");
  assert.equal(fieldGroup("SALARYAFTER"), "Salary revision");
  assert.equal(fieldGroup("IBAN"), "Pay and bank");
  assert.equal(fieldGroup("EMPLOYEENAME"), "Employee");
  assert.equal(fieldGroup("REFNO"), "Letter");
});

test("every employee field lands in a group and none is lost", () => {
  const groups = groupedFields(EMPLOYEE_MERGE_FIELDS, "", "EMPLOYEE");
  assert.equal(groups.flatMap((g) => g.fields).length, EMPLOYEE_MERGE_FIELDS.length);
});

test("searching matches the label or the key and drops empty sections", () => {
  const groups = groupedFields(EMPLOYEE_MERGE_FIELDS, "iban", "EMPLOYEE");
  assert.deepEqual(groups.map((g) => g.group), ["Pay and bank"]);
  assert.ok(groups[0].fields.some((f) => f.key === "IBAN"));
  assert.deepEqual(groupedFields(EMPLOYEE_MERGE_FIELDS, "zzzz", "EMPLOYEE"), []);
});

test("site letters keep one plain list", () => {
  const groups = groupedFields(LETTER_MERGE_FIELDS_FOR_TEST, "", "SITE");
  assert.equal(groups.length, 1);
  assert.equal(groups[0].group, "Fields");
});
