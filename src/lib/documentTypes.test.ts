import assert from "node:assert/strict";
import { test } from "node:test";
import { buildChecklist, docTypeKey, parseReminderDays, resolveDocTypes, isRequired } from "./documentTypes";

const NOW = Date.UTC(2026, 9, 23);
const day = (n: number) => new Date(NOW + n * 86400000).toISOString();

test("built-ins resolve with no rows, and a row overrides one", () => {
  const base = resolveDocTypes([], "SUPPLIER");
  assert.ok(base.find((t) => t.key === "TRADE_LICENSE"));
  const over = resolveDocTypes([{ appliesTo: "SUPPLIER", key: "TRN_CERTIFICATE", label: "VAT cert", hasExpiry: false, required: "YES", reminderDays: [], sortOrder: 0, isActive: true }], "SUPPLIER");
  const t = over.find((x) => x.key === "TRN_CERTIFICATE")!;
  assert.equal(t.label, "VAT cert");
  assert.equal(t.required, "YES");
  assert.equal(t.builtIn, true);
  assert.equal(over.length, base.length);
});

test("a custom type is added after the built-ins and scoped to its target", () => {
  const all = resolveDocTypes([{ appliesTo: "SUPPLIER_PARTY", key: "NOC", label: "NOC", hasExpiry: true, required: "NO", reminderDays: [30], sortOrder: 0, isActive: true }]);
  assert.equal(resolveDocTypes([], "SUPPLIER").some((t) => t.key === "NOC"), false);
  assert.equal(all.find((t) => t.key === "NOC")?.builtIn, false);
  assert.equal(resolveDocTypes(all.map((t) => ({ ...t })), "SUPPLIER_PARTY").at(-1)?.key, "NOC");
});

test("tenancy agreement is required only for an own company", () => {
  const t = resolveDocTypes([], "SUPPLIER").find((x) => x.key === "EJARI_TENANCY")!;
  assert.equal(isRequired(t, true), true);
  assert.equal(isRequired(t, false), false);
});

test("checklist: missing, expiring, expired, valid; longest-running file stands", () => {
  const types = resolveDocTypes([], "SUPPLIER");
  const files = [
    { id: "old", docType: "TRADE_LICENSE", filename: "a", expiryDate: day(-10), uploadedAt: day(-400) },
    { id: "new", docType: "TRADE_LICENSE", filename: "b", expiryDate: day(200), uploadedAt: day(-5) },
    { id: "mo", docType: "MOHRE_PERMIT", filename: "c", expiryDate: day(20), uploadedAt: day(-5) },
    { id: "ch", docType: "CHAMBER_OF_COMMERCE", filename: "d", expiryDate: day(-1), uploadedAt: day(-5) },
    { id: "vat", docType: "TRN_CERTIFICATE", filename: "e", expiryDate: null, uploadedAt: day(-5) },
  ];
  const rows = Object.fromEntries(buildChecklist(types, files, false, NOW).map((r) => [r.type.key, r]));
  assert.equal(rows.TRADE_LICENSE.current?.id, "new");
  assert.equal(rows.TRADE_LICENSE.state, "valid");
  assert.equal(rows.TRADE_LICENSE.count, 2);
  assert.equal(rows.MOHRE_PERMIT.state, "expiring");
  assert.equal(rows.CHAMBER_OF_COMMERCE.state, "expired");
  assert.equal(rows.TRN_CERTIFICATE.state, "valid");
  assert.equal(rows.ESTABLISHMENT_CARD.state, "missing");
  assert.equal(rows.ESTABLISHMENT_CARD.required, true);
});

test("an inactive type is hidden unless it holds a file", () => {
  const types = resolveDocTypes([{ appliesTo: "SUPPLIER", key: "MOHRE_PERMIT", label: "MOHRE permit", hasExpiry: true, required: "NO", reminderDays: [], sortOrder: 0, isActive: false }], "SUPPLIER");
  assert.equal(buildChecklist(types, [], false, NOW).some((r) => r.type.key === "MOHRE_PERMIT"), false);
  assert.equal(buildChecklist(types, [{ id: "x", docType: "MOHRE_PERMIT", filename: "f", expiryDate: null, uploadedAt: day(0) }], false, NOW).some((r) => r.type.key === "MOHRE_PERMIT"), true);
});

test("key and reminder parsing", () => {
  assert.equal(docTypeKey(" Pest control cert. "), "PEST_CONTROL_CERT");
  assert.deepEqual(parseReminderDays("30, 90 7 7 abc -5 120"), [90, 30, 7]);
});

test("vehicle types: Mulkiya and insurance are required, and the registry scopes them to vehicles", () => {
  const v = resolveDocTypes([], "VEHICLE");
  assert.equal(v.find((t) => t.key === "VEHICLE_REGISTRATION")?.required, "YES");
  assert.equal(v.find((t) => t.key === "VEHICLE_INSURANCE")?.required, "YES");
  assert.equal(v.some((t) => t.key === "PASSPORT"), false);
  assert.equal(resolveDocTypes([], "SUPPLIER").some((t) => t.key === "VEHICLE_INSURANCE"), false);
  const custom = resolveDocTypes([{ appliesTo: "VEHICLE", key: "GPS_CERT", label: "GPS tracker certificate", hasExpiry: true, required: "NO", reminderDays: [30], sortOrder: 0, isActive: true }], "VEHICLE");
  assert.equal(custom.at(-1)?.key, "GPS_CERT");
});
