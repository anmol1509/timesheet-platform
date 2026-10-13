import { test } from "node:test";
import assert from "node:assert/strict";
import { payrollCompanyId } from "./payrollCompany";

const own = { isOwnCompany: true };
const other = { isOwnCompany: false };

test("sponsor company decides when it is one of ours", () => {
  assert.equal(payrollCompanyId({ supplierId: "A", supplier: own, sponsorSupplierId: "B", sponsorSupplier: own }), "B");
});
test("employer decides when no sponsor is set or the sponsor is not ours", () => {
  assert.equal(payrollCompanyId({ supplierId: "A", supplier: own, sponsorSupplierId: null, sponsorSupplier: null }), "A");
  assert.equal(payrollCompanyId({ supplierId: "A", supplier: own, sponsorSupplierId: "X", sponsorSupplier: other }), "A");
});
test("employees of other companies are not in payroll", () => {
  assert.equal(payrollCompanyId({ supplierId: "X", supplier: other, sponsorSupplierId: "B", sponsorSupplier: own }), null);
  assert.equal(payrollCompanyId({ supplierId: null, supplier: null, sponsorSupplierId: null, sponsorSupplier: null }), null);
});
