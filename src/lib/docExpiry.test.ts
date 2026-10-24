import assert from "node:assert/strict";
import { test } from "node:test";
import { dueReminder, registryExpiries, type ExpiryFile } from "./docExpiry";

const d = (n: number) => new Date(Date.UTC(2026, 9, 23) + n * 86400000);
const sup = [{ id: "s1", name: "ABC Manpower", isOwnCompany: false, workers: 3 }];
const parties = [{ id: "p1", role: "OWNER", name: "Khalid", supplierId: "s1", supplierName: "ABC Manpower" }];
const veh = [{ id: "v1", plateNumber: "A 12345", label: "Toyota Hiace", status: "ACTIVE", registrationExpiry: d(20), insuranceExpiry: d(40) }];
const f = (o: Partial<ExpiryFile> & Pick<ExpiryFile, "id" | "entityType" | "entityId" | "docType">): ExpiryFile => ({ filename: o.id, expiryDate: d(30), branchId: "b", ...o });
const run = (files: ExpiryFile[], extra: Partial<Parameters<typeof registryExpiries>[0]> = {}) =>
  registryExpiries({ files, suppliers: sup, parties, vehicles: veh, typeRows: [], ...extra });

test("the longest-running file of a type stands; older ones are ignored", () => {
  const r = run([
    f({ id: "old", entityType: "SUPPLIER_PARTY", entityId: "p1", docType: "PASSPORT", expiryDate: d(-5) }),
    f({ id: "new", entityType: "SUPPLIER_PARTY", entityId: "p1", docType: "PASSPORT", expiryDate: d(60) }),
  ]).filter((x) => x.kind === "party");
  assert.equal(r.length, 1);
  assert.equal(r[0].attachmentId, "new");
  assert.equal(r[0].subjectRef, "Owner · ABC Manpower");
  assert.equal(r[0].href, "/suppliers/s1");
});

test("trade licence and workmen comp are left to the existing sources", () => {
  const r = run([f({ id: "a", entityType: "SUPPLIER", entityId: "s1", docType: "TRADE_LICENSE" }), f({ id: "b", entityType: "SUPPLIER", entityId: "s1", docType: "WORKMEN_COMPENSATION" }), f({ id: "c", entityType: "SUPPLIER", entityId: "s1", docType: "MOHRE_PERMIT" })]);
  assert.deepEqual(r.filter((x) => x.kind === "supplier").map((x) => x.docType), ["MOHRE_PERMIT"]);
});

test("types without an expiry, switched off, or unknown are skipped; reminder days come from the type", () => {
  const typeRows = [{ branchId: "b", appliesTo: "SUPPLIER", key: "MOHRE_PERMIT", label: "MOHRE", hasExpiry: true, required: "NO", reminderDays: [45, 10], sortOrder: 0, isActive: true }, { branchId: "b", appliesTo: "SUPPLIER", key: "CHAMBER_OF_COMMERCE", label: "Chamber", hasExpiry: true, required: "NO", reminderDays: [], sortOrder: 0, isActive: false }];
  const r = run([f({ id: "m", entityType: "SUPPLIER", entityId: "s1", docType: "MOHRE_PERMIT" }), f({ id: "c", entityType: "SUPPLIER", entityId: "s1", docType: "CHAMBER_OF_COMMERCE" }), f({ id: "v", entityType: "SUPPLIER", entityId: "s1", docType: "TRN_CERTIFICATE" }), f({ id: "x", entityType: "SUPPLIER", entityId: "s1", docType: "MADE_UP" })], { typeRows });
  assert.deepEqual(r.filter((x) => x.kind === "supplier").map((x) => [x.docType, x.reminderDays]), [["MOHRE_PERMIT", [45, 10]]]);
});

test("several OTHER files are each their own renewal", () => {
  const r = run([f({ id: "1", entityType: "SUPPLIER", entityId: "s1", docType: "OTHER", filename: "pest.pdf" }), f({ id: "2", entityType: "SUPPLIER", entityId: "s1", docType: "OTHER", filename: "fire.pdf", expiryDate: d(50) })]);
  assert.equal(r.filter((x) => x.docType === "OTHER").length, 2);
});

test("a vehicle with only typed dates still appears; a filed Mulkiya replaces its typed date", () => {
  const none = run([]).filter((x) => x.kind === "vehicle");
  assert.deepEqual(none.map((x) => x.docType).sort(), ["VEHICLE_INSURANCE", "VEHICLE_REGISTRATION"]);
  const filed = run([f({ id: "r", entityType: "VEHICLE", entityId: "v1", docType: "VEHICLE_REGISTRATION", expiryDate: d(300) })]).filter((x) => x.kind === "vehicle");
  assert.equal(filed.filter((x) => x.docType === "VEHICLE_REGISTRATION").length, 1);
  assert.equal(filed.find((x) => x.docType === "VEHICLE_REGISTRATION")?.attachmentId, "r");
});

test("an inactive vehicle is left out", () => {
  assert.equal(run([], { vehicles: [{ ...veh[0], status: "INACTIVE" }] }).length, 0);
});

test("dueReminder: the step a document has reached", () => {
  assert.equal(dueReminder(100, [90, 60, 30, 7]), null);
  assert.equal(dueReminder(90, [90, 60, 30, 7]), 90);
  assert.equal(dueReminder(45, [90, 60, 30, 7]), 60);
  assert.equal(dueReminder(7, [90, 60, 30, 7]), 7);
  assert.equal(dueReminder(-1, [90, 60, 30, 7]), 0);
  assert.equal(dueReminder(10, []), null);
});
