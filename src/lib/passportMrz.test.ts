import test from "node:test";
import assert from "node:assert/strict";
import { readMrzLine2, reconcilePassport } from "./passportMrz";

const REF = new Date("2026-10-17T00:00:00Z");
// The Burundi passport that was read wrongly: issued 24.10.2024, expires 24.10.2034.
const MRZ = "P001073228BDI9704231M3410244<<<<<<<<<<<<<<00";

test("reads number, birth date and expiry from the MRZ when the check digits pass", () => {
  assert.deepEqual(readMrzLine2(MRZ, REF), { passportNumber: "P00107322", dateOfBirth: "1997-04-23", passportExpiry: "2034-10-24" });
});

test("tolerates spaces and « characters in the OCR", () => {
  assert.equal(readMrzLine2("P001073228BDI970423 1M3410244«««««««««««««00", REF)?.passportExpiry, "2034-10-24");
});

test("a field whose check digit fails is not trusted", () => {
  const bad = "P001073228BDI9704231M3410245<<<<<<<<<<<<<<00";
  assert.equal(readMrzLine2(bad, REF)?.passportExpiry, undefined);
});

test("the MRZ expiry overrules a swapped visual-zone date", () => {
  const r = reconcilePassport({ passportExpiry: "2024-10-24", passportIssueDate: "2024-10-24", mrzLine2: MRZ }, REF);
  assert.equal(r.passportExpiry, "2034-10-24");
});

test("without a readable MRZ, an expiry that equals the issue date is dropped, not saved", () => {
  assert.equal(reconcilePassport({ passportExpiry: "2024-10-24", passportIssueDate: "2024-10-24", mrzLine2: "" }, REF).passportExpiry, "");
  assert.equal(reconcilePassport({ passportExpiry: "2034-10-24", passportIssueDate: "2024-10-24", mrzLine2: "" }, REF).passportExpiry, "2034-10-24");
});

test("one bad field does not stop the others being used", () => {
  const r = readMrzLine2("P001073228BDI9704232M3410244<<<<<<<<<<<<<<00", REF);
  assert.equal(r?.passportExpiry, "2034-10-24");
  assert.equal(r?.dateOfBirth, undefined);
});
