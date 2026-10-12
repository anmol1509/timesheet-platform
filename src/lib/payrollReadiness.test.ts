import test from "node:test";
import assert from "node:assert/strict";
import { payrollReadiness, type ReadinessFacts } from "./payrollReadiness";

const ok: ReadinessFacts = {
  company: { name: "TKG", isOwnCompany: true, payType: "BASIC" },
  payStructure: "ITEMISED", basicSalary: 3000, flatMonthlyRate: 0, hourlyRate: 0,
  paymentMode: "WPS", molPersonCode: "1234567", routingCode: "123456789", account: "AE070331234567890123456",
  laborCardExpiry: new Date("2027-01-01"), emiratesIdExpiry: new Date("2027-01-01"), visaExpiry: new Date("2027-01-01"),
};
const now = new Date("2026-10-12");

test("a fully set up worker is ready", () => {
  const r = payrollReadiness(ok, now);
  assert.equal(r.ready, true);
  assert.ok(r.items.every((i) => i.ok));
});

test("missing bank details block payroll and name what is missing", () => {
  const r = payrollReadiness({ ...ok, routingCode: null, account: null }, now);
  assert.equal(r.ready, false);
  const bank = r.items.find((i) => i.key === "bank")!;
  assert.equal(bank.ok, false);
  assert.match(bank.problem!, /routing code/);
  assert.match(bank.problem!, /IBAN/);
});

test("cash workers need no bank details", () => {
  assert.equal(payrollReadiness({ ...ok, paymentMode: "Cash", routingCode: null, account: null, molPersonCode: null }, now).ready, true);
});

test("an expired document warns but doesn't block", () => {
  const r = payrollReadiness({ ...ok, visaExpiry: new Date("2026-09-01") }, now);
  assert.equal(r.ready, true);
  assert.equal(r.items.find((i) => i.key === "visa")!.ok, false);
});

test("an hourly company needs an hourly rate", () => {
  const r = payrollReadiness({ ...ok, company: { name: "TKG", isOwnCompany: true, payType: "HOURLY" }, hourlyRate: 0 }, now);
  assert.equal(r.items.find((i) => i.key === "pay")!.ok, false);
});

test("workers outside your own companies don't use the checklist", () => {
  assert.equal(payrollReadiness({ ...ok, company: { name: "Supplier X", isOwnCompany: false, payType: null } }, now).applies, false);
  assert.equal(payrollReadiness({ ...ok, company: null }, now).applies, false);
});
