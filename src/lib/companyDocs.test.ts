import test from "node:test";
import assert from "node:assert/strict";
import { buildCompanyCells, companyBadness, companyComplete, companyPrintIds } from "../app/(platform)/(app)/documents/company-docs";

const NOW = new Date("2026-10-17T00:00:00Z").getTime();
const day = (n: number) => new Date(NOW + n * 86_400_000).toISOString();
const sup = (id: string, trn: string | null, lic: string | null = null) => ({ id, name: id, trn, tradeLicenseExpiry: lic });

test("each document gets a state from its expiry; a renewal replaces the old file", () => {
  const cells = buildCompanyCells(
    [sup("a", "100")],
    [
      { id: "old", supplierId: "a", docType: "TRADE_LICENSE", expiryDate: day(-20), uploadedAt: day(-400) },
      { id: "new", supplierId: "a", docType: "TRADE_LICENSE", expiryDate: day(200), uploadedAt: day(-5) },
      { id: "wc", supplierId: "a", docType: "WORKMEN_COMPENSATION_INSURANCE", expiryDate: day(10), uploadedAt: day(-5) },
    ],
    NOW,
  );
  const r = cells.get("a")!;
  assert.equal(r.TRADE_LICENSE.attachmentId, "new");
  assert.equal(r.TRADE_LICENSE.state, "valid");
  assert.equal(r.WC.state, "expiring");
  assert.equal(r.VAT.state, "missing");
  assert.equal(r.MOHRE.state, "missing");
});

test("a supplier without a VAT number is not expected to hold a VAT certificate, unless it has one", () => {
  const cells = buildCompanyCells([sup("a", null), sup("b", null)], [{ id: "v", supplierId: "b", docType: "TRN_CERTIFICATE", expiryDate: null, uploadedAt: day(-1) }], NOW);
  assert.equal(cells.get("a")!.VAT.state, "na");
  assert.equal(cells.get("b")!.VAT.state, "valid");
  assert.deepEqual(companyComplete(cells.get("a")!), { ok: 0, of: 4 });
});

test("the licence date on the supplier record counts when the file has none", () => {
  const cells = buildCompanyCells([sup("a", "1", day(-3))], [{ id: "l", supplierId: "a", docType: "TRADE_LICENSE", expiryDate: null, uploadedAt: day(-1) }], NOW);
  assert.equal(cells.get("a")!.TRADE_LICENSE.state, "expired");
});

test("print list: chosen kinds only, in column order, counting what is missing", () => {
  const cells = buildCompanyCells(
    [sup("a", "1"), sup("b", null)],
    [
      { id: "al", supplierId: "a", docType: "TRADE_LICENSE", expiryDate: day(100), uploadedAt: day(-1) },
      { id: "aw", supplierId: "a", docType: "WORKMEN_COMPENSATION", expiryDate: day(100), uploadedAt: day(-1) },
      { id: "bl", supplierId: "b", docType: "TRADE_LICENSE", expiryDate: day(100), uploadedAt: day(-1) },
    ],
    NOW,
  );
  const both = companyPrintIds(["a", "b"], ["TRADE_LICENSE", "VAT", "WC"], cells);
  assert.deepEqual(both.ids, ["att:al", "att:aw", "att:bl"]);
  assert.equal(both.missing, 2); // a has no VAT certificate, b has no workmen comp; b's VAT is not needed
  assert.deepEqual(companyPrintIds(["a"], ["WC"], cells).ids, ["att:aw"]);
  assert.ok(companyBadness(cells.get("b")!) > companyBadness(cells.get("a")!) - 1);
});

test("several workmen comp policies: the worst sets the colour, all in use print, the count shows", () => {
  const atts = [
    { id: "w1", supplierId: "a", docType: "WORKMEN_COMPENSATION", expiryDate: day(200), uploadedAt: day(-1) },
    { id: "w2", supplierId: "a", docType: "WORKMEN_COMPENSATION_INSURANCE", expiryDate: day(-5), uploadedAt: day(-1) },
    { id: "w3", supplierId: "a", docType: "WORKMEN_COMPENSATION", expiryDate: day(-300), uploadedAt: day(-1) }, // replaced, no worker on it
  ];
  const cells = buildCompanyCells([sup("a", "1")], atts, NOW, new Set(["w1", "w2"]));
  const wc = cells.get("a")!.WC;
  assert.equal(wc.state, "expired");
  assert.equal(wc.sub, "2 policies");
  assert.deepEqual(companyPrintIds(["a"], ["WC"], cells).ids, ["att:w1", "att:w2"]);
  // Nobody linked yet: the longest-running stands for the supplier.
  const solo = buildCompanyCells([sup("a", "1")], atts, NOW).get("a")!.WC;
  assert.equal(solo.state, "valid");
  assert.equal(solo.policies, 1);
});
