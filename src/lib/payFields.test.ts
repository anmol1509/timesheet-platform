import test from "node:test";
import assert from "node:assert/strict";
import { fixedMonthly, payColumns, payFieldsFor, payInputFromRate, payRevision } from "./payFields";

test("one pay rate becomes the right column for each structure", () => {
  assert.deepEqual(payFieldsFor(payInputFromRate("FLAT", 2500)), { fields: { payStructure: "FLAT", flatMonthlyRate: 2500, payOverride: true } });
  assert.deepEqual(payFieldsFor(payInputFromRate("HOURLY", 15)), { fields: { payStructure: "HOURLY", hourlyRate: 15, payOverride: true } });
  const it = payFieldsFor(payInputFromRate("ITEMISED", 1500, { housing: 500, transport: 200 }));
  assert.ok("fields" in it && it.fields.basicSalary === 1500 && it.fields.housingAllowance === 500 && it.fields.foodAllowance === null);
});

test("a structure with no rate is refused, and a negative amount too", () => {
  assert.match((payFieldsFor(payInputFromRate("FLAT", null)) as { error: string }).error, /monthly salary/);
  assert.match((payFieldsFor(payInputFromRate("HOURLY", 0)) as { error: string }).error, /hourly rate/);
  assert.match((payFieldsFor(payInputFromRate("ITEMISED", -1)) as { error: string }).error, /negative/);
});

test("switching structure clears the figures the new structure doesn't use", () => {
  const cols = payColumns({ payStructure: "HOURLY", hourlyRate: 15, basicSalary: 2000, flatMonthlyRate: 1000 });
  assert.deepEqual(cols, { payStructure: "HOURLY", basicSalary: null, housingAllowance: null, foodAllowance: null, transportAllowance: null, otherAllowance: null, flatMonthlyRate: null, hourlyRate: 15 });
});

test("the fixed monthly figure is basic plus allowances, or the flat rate, and nothing for hourly", () => {
  assert.equal(fixedMonthly({ payStructure: "ITEMISED", basicSalary: 1500, housingAllowance: 500, transportAllowance: 200 }), 2200);
  assert.equal(fixedMonthly({ payStructure: "FLAT", flatMonthlyRate: 2500 }), 2500);
  assert.equal(fixedMonthly({ payStructure: "HOURLY", hourlyRate: 15 }), 0);
});

test("a pay-history record is made for a real change only", () => {
  const none = { payStructure: null as string | null };
  const first = payRevision(none, { payStructure: "FLAT", flatMonthlyRate: 2500 });
  assert.ok(first && first.fixedBefore === 0 && first.fixedAfter === 2500);
  assert.equal(payRevision({ payStructure: "FLAT", flatMonthlyRate: 2500 }, { payStructure: "FLAT", flatMonthlyRate: 2500 }), null);
  assert.ok(payRevision({ payStructure: "FLAT", flatMonthlyRate: 2500 }, { payStructure: "FLAT", flatMonthlyRate: 2700 }));
  assert.ok(payRevision({ payStructure: "HOURLY", hourlyRate: 15 }, { payStructure: "HOURLY", hourlyRate: 16 }));
});

import { structuresFor } from "./payFields";

test("a company's pay type limits the structures offered", () => {
  assert.deepEqual(structuresFor("HOURLY"), ["HOURLY"]);
  assert.deepEqual(structuresFor("BASIC"), ["FLAT", "ITEMISED"]);
  assert.deepEqual(structuresFor(null), ["FLAT", "ITEMISED", "HOURLY"]);
});
