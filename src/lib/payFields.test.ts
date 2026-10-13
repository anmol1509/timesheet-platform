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

import { parseMoneyCell, parsePayCells, parsePayStructure } from "./payFields";

test("pay structures are recognised however they are written", () => {
  assert.equal(parsePayStructure("Itemised"), "ITEMISED");
  assert.equal(parsePayStructure(" itemized "), "ITEMISED");
  assert.equal(parsePayStructure("Basic + allowances"), "ITEMISED");
  assert.equal(parsePayStructure("FLAT"), "FLAT");
  assert.equal(parsePayStructure("Monthly"), "FLAT");
  assert.equal(parsePayStructure("per hour"), "HOURLY");
  assert.equal(parsePayStructure("weekly"), null);
  assert.equal(parsePayStructure(""), null);
});

test("money cells accept commas and AED and flag nonsense", () => {
  assert.equal(parseMoneyCell("1,500"), 1500);
  assert.equal(parseMoneyCell("AED 1500.50"), 1500.5);
  assert.equal(parseMoneyCell("  "), null);
  assert.ok(Number.isNaN(parseMoneyCell("a lot")));
});

test("a row with no pay cells leaves pay alone", () => {
  assert.deepEqual(parsePayCells({}), { skip: true });
  assert.deepEqual(parsePayCells({ structure: " ", rate: "" }), { skip: true });
});

test("a pay structure needs a rate and a rate needs a structure", () => {
  assert.match((parsePayCells({ structure: "Flat" }) as { error: string }).error, /rate is required/);
  assert.match((parsePayCells({ rate: "2000" }) as { error: string }).error, /structure is missing/);
  assert.match((parsePayCells({ structure: "Weekly", rate: "100" }) as { error: string }).error, /isn't a pay structure/);
  assert.match((parsePayCells({ structure: "Flat", rate: "abc" }) as { error: string }).error, /isn't a number/);
});

test("a good row becomes a pay input, allowances only for itemised", () => {
  assert.deepEqual(parsePayCells({ structure: "Hourly", rate: "15" }), { input: { choice: "HOURLY", hourly: 15 } });
  const it = parsePayCells({ structure: "Itemised", rate: "1,500", housing: "500", transport: "200" }) as { input: { choice: string; basic: number; housing: number; transport: number } };
  assert.equal(it.input.choice, "ITEMISED");
  assert.equal(it.input.basic, 1500);
  assert.equal(it.input.housing, 500);
  assert.match((parsePayCells({ structure: "Flat", rate: "2000", housing: "300" }) as { error: string }).error, /Itemised/);
});

import { parseWorkTerms, parseYesNo } from "./payFields";

test("yes and no are understood in the usual ways", () => {
  assert.equal(parseYesNo("Yes"), true);
  assert.equal(parseYesNo(" n "), false);
  assert.equal(parseYesNo(""), null);
  assert.equal(parseYesNo("maybe"), undefined);
});

test("working terms: blank leaves everything alone", () => {
  assert.deepEqual(parseWorkTerms({}), { skip: true });
  assert.deepEqual(parseWorkTerms({ dailyHours: " ", overtime: "" }), { skip: true });
});

test("working terms are read with the same limits as the employee form", () => {
  assert.deepEqual(parseWorkTerms({ dailyHours: "9", overtime: "Yes", otMultiplier: "1.25", restOtMultiplier: "1.5", gasWaived: "No" }), { terms: { dailyHours: 9, paysOvertime: true, otMultiplier: 1.25, restOtMultiplier: 1.5, gasWaived: false } });
  assert.deepEqual(parseWorkTerms({ overtime: "No" }), { terms: { paysOvertime: false } });
  assert.match((parseWorkTerms({ dailyHours: "20" }) as { error: string }).error, /1 to 16/);
  assert.match((parseWorkTerms({ otMultiplier: "5" }) as { error: string }).error, /1 to 3/);
  assert.match((parseWorkTerms({ overtime: "sometimes" }) as { error: string }).error, /Yes or No/);
  assert.match((parseWorkTerms({ gasWaived: "x" }) as { error: string }).error, /Yes or No/);
});

// What the employee sheet exports for the three demo workers, imported straight back: nothing should change.
const DEMO = [
  { name: "Itemised", sheet: { structure: "Itemised", rate: "3000", housing: "1000", food: "", transport: "500", other: "", dailyHours: "8", overtime: "Yes", otMultiplier: "1.25", restOtMultiplier: "1.5", gasWaived: "No" },
    cols: { payStructure: "ITEMISED", basicSalary: 3000, housingAllowance: 1000, foodAllowance: null, transportAllowance: 500, otherAllowance: null, flatMonthlyRate: null, hourlyRate: null }, terms: { dailyHours: 8, paysOvertime: true, otMultiplier: 1.25, restOtMultiplier: 1.5, gasWaived: false } },
  { name: "Hourly", sheet: { structure: "Hourly", rate: "15", housing: "", food: "", transport: "", other: "", dailyHours: "8", overtime: "Yes", otMultiplier: "1.25", restOtMultiplier: "1.5", gasWaived: "No" },
    cols: { payStructure: "HOURLY", basicSalary: null, housingAllowance: null, foodAllowance: null, transportAllowance: null, otherAllowance: null, flatMonthlyRate: null, hourlyRate: 15 }, terms: { dailyHours: 8, paysOvertime: true, otMultiplier: 1.25, restOtMultiplier: 1.5, gasWaived: false } },
  { name: "Flat monthly", sheet: { structure: "Flat", rate: "2800", housing: "", food: "", transport: "", other: "", dailyHours: "9", overtime: "Yes", otMultiplier: "1.25", restOtMultiplier: "1.5", gasWaived: "No" },
    cols: { payStructure: "FLAT", basicSalary: null, housingAllowance: null, foodAllowance: null, transportAllowance: null, otherAllowance: null, flatMonthlyRate: 2800, hourlyRate: null }, terms: { dailyHours: 9, paysOvertime: true, otMultiplier: 1.25, restOtMultiplier: 1.5, gasWaived: false } },
];

for (const d of DEMO) {
  test(`a ${d.name} worker's exported sheet row imports back to exactly the same pay`, () => {
    const pay = parsePayCells({ structure: d.sheet.structure, rate: d.sheet.rate, housing: d.sheet.housing, food: d.sheet.food, transport: d.sheet.transport, other: d.sheet.other });
    assert.ok("input" in pay);
    const fields = payFieldsFor((pay as { input: Parameters<typeof payFieldsFor>[0] }).input);
    assert.ok("fields" in fields);
    assert.deepEqual(payColumns((fields as { fields: Record<string, unknown> }).fields), d.cols);
    const terms = parseWorkTerms({ dailyHours: d.sheet.dailyHours, overtime: d.sheet.overtime, otMultiplier: d.sheet.otMultiplier, restOtMultiplier: d.sheet.restOtMultiplier, gasWaived: d.sheet.gasWaived });
    assert.deepEqual(terms, { terms: d.terms });
  });
}
