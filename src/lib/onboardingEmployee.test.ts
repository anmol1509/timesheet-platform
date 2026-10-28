import test from "node:test";
import assert from "node:assert/strict";
import { employeeDocType, employeeFieldsFromStage, missingEssentials, passportProblem, payFieldsFor } from "./onboardingEmployee";

test("candidate files carry over as the nearest worker document type", () => {
  assert.equal(employeeDocType("PASSPORT"), "PASSPORT");
  assert.equal(employeeDocType("ENTRY_PERMIT"), "VISA");
  assert.equal(employeeDocType("ID_VISA"), "VISA");
  assert.equal(employeeDocType("MEDICAL"), "MEDICAL");
  assert.equal(employeeDocType("WPP"), "INSURANCE");
  assert.equal(employeeDocType("OFFER"), "OTHER");
  assert.equal(employeeDocType("something else"), "OTHER");
});

test("pay typed on the review screen becomes pay fields", () => {
  assert.deepEqual(payFieldsFor({ choice: "LATER" }), { fields: {} });
  assert.deepEqual(payFieldsFor({ choice: "FLAT", flat: 2500 }), { fields: { payStructure: "FLAT", flatMonthlyRate: 2500, payOverride: true } });
  assert.deepEqual(payFieldsFor({ choice: "HOURLY", hourly: 15 }), { fields: { payStructure: "HOURLY", hourlyRate: 15, payOverride: true } });
  const itemised = payFieldsFor({ choice: "ITEMISED", basic: 1500, housing: 500 });
  assert.ok("fields" in itemised && itemised.fields.payStructure === "ITEMISED" && itemised.fields.housingAllowance === 500 && itemised.fields.foodAllowance === null);
});

test("a chosen pay type with no amount is refused, and so is a negative amount", () => {
  assert.match((payFieldsFor({ choice: "FLAT" }) as { error: string }).error, /monthly salary/);
  assert.match((payFieldsFor({ choice: "HOURLY", hourly: 0 }) as { error: string }).error, /hourly rate/);
  assert.match((payFieldsFor({ choice: "ITEMISED" }) as { error: string }).error, /basic salary/);
  assert.match((payFieldsFor({ choice: "FLAT", flat: -5 }) as { error: string }).error, /negative/);
});

test("only name, passport number and company are essential", () => {
  assert.deepEqual(missingEssentials({ name: "A", passportNumber: "N123456", supplierId: "s1" }), []);
  assert.deepEqual(missingEssentials({ name: " ", passportNumber: null, supplierId: null }), ["name", "passport number", "company"]);
});

test("a later step's expiry becomes the matching employee date", () => {
  const d = new Date("2027-05-01");
  assert.deepEqual(employeeFieldsFromStage("MEDICAL", d, null), { medicalExpiry: d });
  assert.deepEqual(employeeFieldsFromStage("ID_VISA", d, "301/2026/1/1"), { visaExpiry: d, visaNumber: "301/2026/1/1" });
  assert.deepEqual(employeeFieldsFromStage("CONTRACT", d, null), { laborCardExpiry: d });
  assert.deepEqual(employeeFieldsFromStage("TAWJEEH", d, null), {});
  assert.deepEqual(employeeFieldsFromStage("MEDICAL", null, null), {});
});

test("a passport number must look like one, and may be left empty", () => {
  assert.equal(passportProblem(""), null);
  assert.equal(passportProblem(null), null);
  assert.equal(passportProblem("X1234567"), null);
  assert.equal(passportProblem("N-123 4567"), null);
  assert.ok(passportProblem("12"));
  assert.ok(passportProblem("AB#1234567"));
});
