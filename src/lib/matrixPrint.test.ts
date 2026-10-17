import test from "node:test";
import assert from "node:assert/strict";
import { employeePrintIds, type Cell } from "../app/(platform)/(app)/documents/matrix";

const cell = (docId?: string): Cell => ({ state: docId ? "valid" : "missing", label: "", sub: "", docId });
const row = (docs: Partial<Record<"PASSPORT" | "EMIRATES_ID" | "VISA" | "LABOR_CARD" | "MEDICAL", string>>) => ({
  PASSPORT: cell(docs.PASSPORT), EMIRATES_ID: cell(docs.EMIRATES_ID), VISA: cell(docs.VISA), LABOR_CARD: cell(docs.LABOR_CARD), MEDICAL: cell(docs.MEDICAL), WC: cell(),
});

test("prints the chosen kinds worker by worker and counts what is missing", () => {
  const cells = new Map([
    ["a", row({ PASSPORT: "a-pp", VISA: "a-visa" })],
    ["b", row({ PASSPORT: "b-pp", EMIRATES_ID: "b-eid" })],
  ]);
  const emps = [{ id: "a", supplierId: "s1" }, { id: "b", supplierId: "s1" }];
  const r = employeePrintIds(["a", "b"], ["PASSPORT", "VISA"], cells, emps, []);
  assert.deepEqual(r.ids, ["a-pp", "a-visa", "b-pp"]);
  assert.equal(r.missing, 1); // b has no visa
});

test("workmen comp prints once per supplier, in the end, and counts workers whose supplier has none", () => {
  const cells = new Map([["a", row({})], ["b", row({})], ["c", row({})]]);
  const emps = [{ id: "a", supplierId: "s1" }, { id: "b", supplierId: "s1" }, { id: "c", supplierId: "s2" }];
  const r = employeePrintIds(["a", "b", "c"], ["WC"], cells, emps, [{ supplierId: "s1", expiryDate: null, attachmentId: "cert1" }]);
  assert.deepEqual(r.ids, ["att:cert1"]);
  assert.equal(r.missing, 1);
});

test("nothing chosen prints nothing", () => {
  const r = employeePrintIds(["a"], [], new Map([["a", row({ PASSPORT: "x" })]]), [{ id: "a", supplierId: null }], []);
  assert.deepEqual(r, { ids: [], missing: 0 });
});
