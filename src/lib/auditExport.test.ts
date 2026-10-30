import test from "node:test";
import assert from "node:assert/strict";
import { buildAuditRows, uaeDay, uaeTime, type ExportEntry } from "./auditExport";

const base: ExportEntry = {
  id: "a1", entityType: "EMPLOYEE", entityId: "e1", action: "UPDATE", userName: "Anmol",
  createdAt: new Date("2026-10-29T21:30:00.000Z"), source: null, batchLabel: null, revertOfId: null, revertedAt: null, revertedByName: null,
  changes: { basicSalary: { from: 3000, to: 3200 }, mobileNumber: { from: null, to: "0501234567" } },
};

test("times are shown in UAE time, so a late evening entry lands on the next UAE day", () => {
  assert.equal(uaeTime(base.createdAt), "01:30:00");
  assert.equal(uaeDay(base.createdAt).toISOString(), "2026-10-30T00:00:00.000Z");
});

test("each entry is one readable line and each changed field is its own row", () => {
  const { activity, fields } = buildAuditRows([base], { a1: "Rahul Khan" }, { canSeePay: true });
  assert.equal(activity.length, 1);
  assert.match(String(activity[0][3]), /^Anmol updated Rahul Khan's/);
  assert.equal(activity[0][4], "Changed");
  assert.equal(activity[0][8], 2);
  assert.equal(activity[0][9], "Screen (older entry)");
  assert.equal(fields.length, 2);
  assert.deepEqual(fields[0].slice(7, 10), ["Basic salary", "3,000", "3,200"]);
  assert.deepEqual(fields[1].slice(7, 10), ["Mobile number", "empty", "0501234567"]);
});

test("pay figures are left out for people without payroll access, and the sheet says so", () => {
  const { activity, fields } = buildAuditRows([base], { a1: "Rahul Khan" }, { canSeePay: false });
  assert.equal(fields.length, 1);
  assert.match(String(activity[0][12]), /1 pay figure not shown/);
});

test("a deleted record lists what it held as old values", () => {
  const del: ExportEntry = { ...base, id: "d1", action: "DELETE", changes: { name: "Old Co", trn: "123" } };
  const { fields } = buildAuditRows([del], {}, { canSeePay: true });
  assert.ok(fields.every((f) => f[9] === "" && f[8] !== ""));
});

test("an edit that was put back says who and when", () => {
  const { activity } = buildAuditRows([{ ...base, revertedAt: new Date("2026-10-30T05:00:00.000Z"), revertedByName: "Pooja" }], {}, { canSeePay: true });
  assert.match(String(activity[0][11]), /^Yes, by Pooja on 30 Oct 2026 09:00/);
});

import { csvCell } from "./csvExport";
test("phone numbers keep their plus sign in CSV but formulas are still defused", () => {
  assert.equal(csvCell("+971539843124"), "+971539843124");
  assert.equal(csvCell("-5"), "-5");
  assert.equal(csvCell("=SUM(A1)"), "'=SUM(A1)");
  assert.equal(csvCell("+cmd|' /C calc'!A0"), "'+cmd|' /C calc'!A0");
  assert.equal(csvCell("@x"), "'@x");
});
test("a leading tab is still defused", () => assert.equal(csvCell("\t5"), "'\t5"));
