import test from "node:test";
import assert from "node:assert/strict";
import { buildCells, employeePrintIds, policiesBySupplier, supplierWcCell, workerWcCell, type Cell, type MatrixEmployee, type Policy } from "../app/(platform)/(app)/documents/matrix";

const NOW = new Date("2026-10-17T00:00:00Z").getTime();
const day = (n: number) => new Date(NOW + n * 86_400_000).toISOString().slice(0, 10);
const cell = (docId?: string, attachmentId?: string): Cell => ({ state: docId || attachmentId ? "valid" : "missing", label: "", sub: "", docId, attachmentId });
const row = (docs: Partial<Record<"PASSPORT" | "EMIRATES_ID" | "VISA" | "LABOR_CARD" | "MEDICAL", string>>, wc?: string) => ({
  PASSPORT: cell(docs.PASSPORT), EMIRATES_ID: cell(docs.EMIRATES_ID), VISA: cell(docs.VISA), LABOR_CARD: cell(docs.LABOR_CARD), MEDICAL: cell(docs.MEDICAL), WC: cell(undefined, wc),
});
const emp = (id: string, supplierId: string | null, wcAttachmentId: string | null, wcCovered = false): MatrixEmployee => ({ id, name: id, employeeIdNo: id, hasPhoto: false, supplierId, supplierName: null, projectId: null, wcCovered, wcAttachmentId });
const pol = (supplierId: string, attachmentId: string, expiry: number | null): Policy => ({ supplierId, attachmentId, expiryDate: expiry === null ? null : day(expiry) });

test("prints the chosen kinds worker by worker and counts what is missing", () => {
  const cells = new Map([["a", row({ PASSPORT: "a-pp", VISA: "a-visa" })], ["b", row({ PASSPORT: "b-pp", EMIRATES_ID: "b-eid" })]]);
  const r = employeePrintIds(["a", "b"], ["PASSPORT", "VISA"], cells);
  assert.deepEqual(r.ids, ["a-pp", "a-visa", "b-pp"]);
  assert.equal(r.missing, 1); // b has no visa
});

test("each worker prints their own workmen comp certificate; one covering many prints once", () => {
  const cells = new Map([["a", row({}, "certA")], ["b", row({}, "certA")], ["c", row({}, "certB")], ["d", row({})]]);
  const r = employeePrintIds(["a", "b", "c", "d"], ["WC"], cells);
  assert.deepEqual(r.ids, ["att:certA", "att:certB"]);
  assert.equal(r.missing, 1);
});

test("nothing chosen prints nothing", () => {
  assert.deepEqual(employeePrintIds(["a"], [], new Map([["a", row({ PASSPORT: "x" })]])), { ids: [], missing: 0 });
});

test("a supplier with two policies: each worker follows their own certificate", () => {
  const policies = [pol("s", "p1", 200), pol("s", "p2", -10)];
  const employees = [emp("a", "s", "p1", true), emp("b", "s", "p2", true), emp("c", "s", null, false)];
  const { cells } = buildCells(employees, [], policies, NOW);
  assert.equal(cells.get("a")!.WC.state, "valid");
  assert.equal(cells.get("a")!.WC.attachmentId, "p1");
  assert.equal(cells.get("b")!.WC.state, "expired");
  assert.equal(cells.get("b")!.WC.attachmentId, "p2");
  // Names were read for this supplier, and c is on none of them.
  assert.equal(cells.get("c")!.WC.state, "notlisted");
});

test("when a supplier's certificates were never read, the longest-running one stands in", () => {
  const policies = [pol("s", "p1", 30), pol("s", "p2", 300)];
  const cell = workerWcCell({ supplierId: "s", wcAttachmentId: null }, policies, new Set(), NOW);
  assert.equal(cell.attachmentId, "p2");
  assert.equal(workerWcCell({ supplierId: null }, [], new Set(), NOW).sub, "No supplier");
  assert.equal(workerWcCell({ supplierId: "s" }, [], new Set(), NOW).sub, "No policy");
});

test("the supplier summary counts the policies in use and shows the worst; a replaced old one is ignored", () => {
  const list = policiesBySupplier([pol("s", "old", -200), pol("s", "p1", 200), pol("s", "p2", 10)]).get("s")!;
  const inUse = [{ state: "valid", label: "", sub: "", attachmentId: "p1" }, { state: "expiring", label: "", sub: "", attachmentId: "p2" }, { state: "expiring", label: "", sub: "", attachmentId: "p2" }] as Cell[];
  const s = supplierWcCell(inUse, list, NOW);
  assert.equal(s.policies, 2);
  assert.equal(s.cell.state, "expiring");
  assert.equal(s.cell.sub, "2 policies");
  const none = supplierWcCell([], list, NOW);
  assert.equal(none.policies, 1); // nobody linked yet: the longest-running stands for the supplier
  assert.equal(none.cell.state, "valid");
  assert.equal(supplierWcCell([], [], NOW).cell.sub, "No policy");
});
