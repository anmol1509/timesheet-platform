import test from "node:test";
import assert from "node:assert/strict";
import { checkEmployee, emiratesIdChecksumOk } from "./dataChecks";

const now = new Date("2026-10-12T00:00:00Z");
// 784-1990-1234567-? : the check digit that makes the Luhn sum a multiple of ten.
const withCheck = (body14: string) => { for (let c = 0; c < 10; c++) if (emiratesIdChecksumOk(body14 + c)) return body14 + c; throw new Error("no check digit"); };
const goodEid = withCheck("78419901234567");

test("an Emirates ID needs a valid check digit", () => {
  assert.equal(emiratesIdChecksumOk(goodEid), true);
  assert.equal(emiratesIdChecksumOk(goodEid.slice(0, 14) + ((Number(goodEid[14]) + 1) % 10)), false);
  assert.equal(emiratesIdChecksumOk("123"), false);
});

test("a wrong Emirates ID, short passport and odd UAE mobile each give a warning", () => {
  const bad = checkEmployee({ emiratesId: goodEid.slice(0, 14) + ((Number(goodEid[14]) + 1) % 10), passportNumber: "12", mobileNumber: "+971 41234567" }, null, now);
  assert.equal(bad.length, 3);
  assert.deepEqual(checkEmployee({ emiratesId: goodEid, passportNumber: "N1234567", mobileNumber: "+971 50 123 4567" }, null, now), []);
});

test("an Emirates ID that doesn't start with 784 is called out", () => {
  assert.match(checkEmployee({ emiratesId: "123456789012345" }, null, now)[0], /784/);
});

test("age and join date are sense-checked", () => {
  assert.match(checkEmployee({ dateOfBirth: new Date("2012-01-01") }, null, now)[0], /under 18/);
  assert.match(checkEmployee({ dateOfBirth: new Date("1950-01-01") }, null, now)[0], /Please check the year/);
  assert.match(checkEmployee({ joinDate: new Date("2027-06-01") }, null, now)[0], /3 months in the future/);
  assert.match(checkEmployee({ dateOfBirth: new Date("2000-01-01"), joinDate: new Date("2010-01-01") }, null, now)[0], /15th birthday/);
  assert.deepEqual(checkEmployee({ dateOfBirth: new Date("1990-05-05"), joinDate: new Date("2024-03-01") }, null, now), []);
});

test("an already expired document and a far-future expiry are flagged", () => {
  assert.match(checkEmployee({ visaExpiry: new Date("2026-01-01") }, null, now)[0], /Visa expiry \(01-01-2026\) is already in the past/);
  assert.match(checkEmployee({ passportExpiry: new Date("2050-01-01") }, null, now)[0], /more than 15 years/);
});

test("unusually high pay is flagged", () => {
  assert.match(checkEmployee({ basicSalary: 300000 }, null, now)[0], /unusually high/);
  assert.match(checkEmployee({ hourlyRate: 1500 }, null, now)[0], /Hourly rate/);
  assert.deepEqual(checkEmployee({ basicSalary: 3000, hourlyRate: 15 }, null, now), []);
});

test("only changed fields are checked, so an old record isn't nagged on every save", () => {
  const old = { visaExpiry: new Date("2025-01-01"), basicSalary: 90000 };
  assert.deepEqual(checkEmployee({ ...old }, { ...old }, now), []);
  assert.equal(checkEmployee({ ...old, visaExpiry: new Date("2025-02-02") }, old, now).length, 1);
});

import { checkPartner } from "./dataChecks";

test("a TRN and a trade licence expiry are sense-checked, only when changed", () => {
  assert.match(checkPartner({ trn: "12345" }, null, now)[0], /15 digits/);
  assert.match(checkPartner({ trn: "200123456789012" }, null, now)[0], /start with 100/);
  assert.deepEqual(checkPartner({ trn: "100123456789012" }, null, now), []);
  assert.match(checkPartner({ tradeLicenseExpiry: new Date("2026-01-01") }, null, now)[0], /already in the past/);
  const old = { trn: "12", tradeLicenseExpiry: new Date("2020-01-01") };
  assert.deepEqual(checkPartner({ ...old }, { ...old }, now), []);
});
