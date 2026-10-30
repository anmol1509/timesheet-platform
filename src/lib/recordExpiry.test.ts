import test from "node:test";
import assert from "node:assert/strict";
import { documentLabel, recordExpiries, type RecordFile } from "./recordExpiry";

const base: RecordFile = { source: "clientdoc", id: "d1", ownerId: "c1", ownerName: "Al Noor", ownerKind: "Client", href: "/clients/c1", docType: "CONTRACT", filename: "msa.pdf", expiryDate: new Date("2027-01-01") };

test("an Other document is named by its file, without the extension", () => {
  assert.equal(documentLabel("OTHER", "Fire safety certificate.pdf"), "Fire safety certificate");
  assert.equal(documentLabel("CONTRACT", "msa.pdf"), "Contract");
  assert.equal(documentLabel("SIGNED_ACCEPTANCE", "x.pdf"), "Signed acceptance");
});

test("ids are prefixed by where the document lives so they cannot collide with other records", () => {
  const [r] = recordExpiries([base]);
  assert.equal(r.subjectId, "clientdoc:d1");
  assert.equal(r.subjectName, "Al Noor");
  assert.equal(r.subjectRef, "Client");
  assert.deepEqual(r.reminderDays, [90, 60, 30, 7]);
});

test("only the latest trade licence of a client counts, but every contract and other file does", () => {
  const out = recordExpiries([
    { ...base, id: "a", docType: "TRADE_LICENSE", expiryDate: new Date("2026-01-01") },
    { ...base, id: "b", docType: "TRADE_LICENSE", expiryDate: new Date("2027-06-01") },
    { ...base, id: "c", docType: "CONTRACT", expiryDate: new Date("2026-03-01") },
    { ...base, id: "d", docType: "CONTRACT", expiryDate: new Date("2027-03-01") },
    { ...base, id: "e", docType: "OTHER", filename: "Insurance.pdf" },
  ]);
  assert.equal(out.filter((x) => x.docType === "TRADE_LICENSE").length, 1);
  assert.equal(out.find((x) => x.docType === "TRADE_LICENSE")!.subjectId, "clientdoc:b");
  assert.equal(out.filter((x) => x.docType === "CONTRACT").length, 2);
  assert.equal(out.length, 4);
});
