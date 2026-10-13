import test from "node:test";
import assert from "node:assert/strict";
import { PAPERS, papersPendingFrom, pendingGateItems, seedPapers } from "./papers";

test("there are seven papers and three of them gate 'papers pending'", () => {
  assert.equal(PAPERS.length, 7);
  assert.deepEqual(PAPERS.filter((p) => p.gate).map((p) => p.key), ["MEDICAL", "VISA_STAMPING", "CONTRACT_LABOUR_CARD"]);
});

test("papers are pending until medical is fit, the visa is stamped and the labour card is issued", () => {
  const rows = [{ item: "MEDICAL", status: "Fit" }, { item: "VISA_STAMPING", status: "Stamped" }, { item: "CONTRACT_LABOUR_CARD", status: "Approved" }];
  assert.equal(papersPendingFrom(rows), true);
  assert.deepEqual(pendingGateItems(rows).map((p) => p.key), ["CONTRACT_LABOUR_CARD"]);
  assert.equal(papersPendingFrom([...rows.slice(0, 2), { item: "CONTRACT_LABOUR_CARD", status: "Issued" }]), false);
});

test("a missing row counts as pending, and an unfit medical doesn't clear it", () => {
  assert.equal(papersPendingFrom([]), true);
  assert.equal(papersPendingFrom([{ item: "MEDICAL", status: "Unfit" }, { item: "VISA_STAMPING", status: "Stamped" }, { item: "CONTRACT_LABOUR_CARD", status: "Issued" }]), true);
});

test("other papers (Tawjeeh, ILOE, health card, Emirates ID) don't hold papers pending", () => {
  const gates = [{ item: "MEDICAL", status: "Fit" }, { item: "VISA_STAMPING", status: "Stamped" }, { item: "CONTRACT_LABOUR_CARD", status: "Issued" }];
  assert.equal(papersPendingFrom([...gates, { item: "TAWJEEH", status: "Pending" }, { item: "ILOE", status: "Pending" }]), false);
});

test("an onboarding candidate's progress carries over, with dates, references and expiries", () => {
  const rows = seedPapers(
    { medicalStatus: "Fit", tawjeehStatus: "Completed", iloeStatus: "Applied", contractStatus: "Submitted", idVisaStatus: "Completed" },
    [
      { stage: "MEDICAL", statusDate: new Date("2026-09-01"), referenceNo: "MED-1", expiryDate: new Date("2027-09-01") },
      { stage: "ID_VISA", statusDate: new Date("2026-09-10"), referenceNo: "VISA-9", expiryDate: new Date("2028-09-10") },
    ],
  );
  const by = Object.fromEntries(rows.map((r) => [r.item, r]));
  assert.equal(by.MEDICAL.status, "Fit");
  assert.equal(by.MEDICAL.referenceNo, "MED-1");
  assert.equal(by.MEDICAL.expiryDate?.toISOString().slice(0, 10), "2027-09-01");
  assert.equal(by.TAWJEEH.status, "Done");
  assert.equal(by.ILOE.status, "Applied");
  assert.equal(by.CONTRACT_LABOUR_CARD.status, "Submitted");
  assert.equal(by.VISA_STAMPING.status, "Stamped");
  assert.equal(by.EID_BIOMETRICS.status, "Pending");
  assert.equal(by.HEALTH_CARD.status, "Pending");
  assert.equal(rows.length, 7);
});

test("a candidate with nothing recorded starts every paper as pending", () => {
  const rows = seedPapers({ medicalStatus: "Pending", tawjeehStatus: "Pending", iloeStatus: "Pending", contractStatus: "Pending", idVisaStatus: "Pending" });
  assert.ok(rows.every((r) => r.status === "Pending" && r.statusDate === null));
});
