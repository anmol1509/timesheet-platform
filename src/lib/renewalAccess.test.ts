import test from "node:test";
import assert from "node:assert/strict";
import { canSeeRenewal } from "./renewalAccess";

const staff = (permissions: string[]) => ({ role: "STAFF", permissions });
const renewalsOnly = staff(["workforce.renewals:view", "workforce.renewals:edit"]);

test("a worker's own renewal follows the Renewals permission alone", () => {
  assert.equal(canSeeRenewal(renewalsOnly, { kind: "employee", subjectId: "e1" }), true);
});

test("a document filed on a client, project, quotation, bill or vehicle needs that area too", () => {
  assert.equal(canSeeRenewal(renewalsOnly, { kind: "record", subjectId: "clientdoc:1" }), false);
  assert.equal(canSeeRenewal(staff([...renewalsOnly.permissions, "partners.clients:view"]), { kind: "record", subjectId: "clientdoc:1" }), true);
  assert.equal(canSeeRenewal(renewalsOnly, { kind: "record", subjectId: "projdoc:1" }), false);
  assert.equal(canSeeRenewal(renewalsOnly, { kind: "record", subjectId: "attach:1", entityType: "QUOTATION" }), false);
  assert.equal(canSeeRenewal(staff(["workforce.renewals:view", "sales.quotations:view"]), { kind: "record", subjectId: "attach:1", entityType: "QUOTATION" }), true);
  assert.equal(canSeeRenewal(renewalsOnly, { kind: "vehicle", subjectId: "v1" }), false);
});

test("owners' and sponsors' papers need My Companies", () => {
  assert.equal(canSeeRenewal(renewalsOnly, { kind: "party", subjectId: "p1" }), false);
  assert.equal(canSeeRenewal(staff(["workforce.renewals:view", "mycompanies:view"]), { kind: "party", subjectId: "p1" }), true);
});

test("administrators see everything", () => {
  for (const kind of ["employee", "supplier", "party", "vehicle", "record"]) assert.equal(canSeeRenewal({ role: "BRANCH_ADMIN" }, { kind, subjectId: "clientdoc:1" }), true, kind);
});
