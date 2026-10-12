import test from "node:test";
import assert from "node:assert/strict";
import { auditFields, auditSentence, auditValue, nameFromChanges } from "./auditSentence";

const pay = { canSeePay: true };
const update = (changes: Record<string, unknown>, entityType = "EMPLOYEE") => ({ entityType, action: "UPDATE", changes });

test("one changed field reads as a full sentence", () => {
  assert.equal(auditSentence(update({ basicSalary: { from: 3000, to: 3200 } }), "Rahul Khan", pay), "changed Rahul Khan's basic salary from 3,000 to 3,200");
});

test("several changes list the first fields and count the rest", () => {
  const e = update({ name: { from: "A", to: "B" }, mobileNumber: { from: "1", to: "2" }, gender: { from: "M", to: "F" }, nationality: { from: "x", to: "y" }, category: { from: "p", to: "q" } });
  assert.equal(auditSentence(e, "Rahul Khan", pay), "updated Rahul Khan's name, mobile number, gender and 2 more");
});

test("a name ending in s gets a bare apostrophe", () => {
  assert.equal(auditSentence(update({ gender: { from: "M", to: "F" } }), "Chris", pay), "changed Chris' gender from M to F");
});

test("create and delete name the record, taking the name from the snapshot when needed", () => {
  assert.equal(auditSentence({ entityType: "CLIENT", action: "CREATE", changes: { name: "Acme LLC" } }, null, pay), "added client Acme LLC");
  assert.equal(auditSentence({ entityType: "PROJECT", action: "DELETE", changes: { name: "Tower A", clientId: "cabcdefghijklmnopqrstuvw" } }, null, pay), "deleted project Tower A");
});

test("pay figures are hidden from people who can't see pay", () => {
  const e = update({ basicSalary: { from: 3000, to: 3200 }, gender: { from: "M", to: "F" } });
  const f = auditFields(e, { canSeePay: false });
  assert.deepEqual(f.shown.map((x) => x.key), ["gender"]);
  assert.equal(f.hiddenPay, 1);
  assert.equal(auditSentence(update({ basicSalary: { from: 3000, to: 3200 } }), "Rahul Khan", { canSeePay: false }), "changed pay details on employee Rahul Khan");
});

test("ids and bookkeeping columns are left out", () => {
  const f = auditFields(update({ projectId: { from: "a", to: "b" }, updatedAt: { from: "x", to: "y" }, employeeIdNo: { from: "1", to: "2" } }), pay);
  assert.deepEqual(f.shown.map((x) => x.key), ["employeeIdNo"]);
});

test("values read like a person wrote them", () => {
  assert.equal(auditValue("joinDate", "2026-09-01T00:00:00.000Z"), "01-09-2026");
  assert.equal(auditValue("gasWaived", true), "yes");
  assert.equal(auditValue("note", null), "empty");
  assert.equal(auditValue("payStructure", "ITEMISED"), "ITEMISED");
  assert.equal(auditValue("projectId", "cmabcdefghijklmnopqrstuv"), "a linked record");
  assert.equal(auditValue("hourlyRate", 12.5), "12.50");
});

test("names come from the snapshot, newest value first", () => {
  assert.equal(nameFromChanges({ name: { from: "Old", to: "New" } }), "New");
  assert.equal(nameFromChanges({ month: "2026-09", company: "TKG" }), "TKG 2026-09");
  assert.equal(nameFromChanges(null), null);
});

test("a record that belongs to an employee names the employee", () => {
  const e = { entityType: "ACCOMMODATION", action: "UPDATE", changes: { bedLabel: { from: "A1", to: "B2" } } };
  assert.equal(auditSentence(e, "for Rahul Khan", pay), "changed accommodation for Rahul Khan: bed label from A1 to B2");
});
