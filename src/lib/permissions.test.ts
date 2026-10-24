import assert from "node:assert/strict";
import { test } from "node:test";
import { MODULES, ROLE_PRESETS, canMyCompanies, canViewSensitive, sanitizePermissions } from "./permissions";

const staff = (permissions: string[] | null) => ({ role: "STAFF", permissions });

test("admins can open sensitive documents", () => {
  assert.equal(canViewSensitive({ role: "SUPER_ADMIN" }), true);
  assert.equal(canViewSensitive({ role: "BRANCH_ADMIN", permissions: [] }), true);
});

test("staff need the Sensitive documents grant itself", () => {
  assert.equal(canViewSensitive(staff(["sensitive:view"])), true);
  assert.equal(canViewSensitive(staff(["partners:view", "partners:edit", "partners.suppliers:view"])), false);
  assert.equal(canViewSensitive(staff([])), false);
});

test("staff with no role, who otherwise get every operational module, do not get it", () => {
  assert.equal(canViewSensitive(staff(null)), false);
  assert.equal(canViewSensitive({ role: "STAFF" }), false);
});

test("the grant can be saved on a role, and no starter role includes it", () => {
  assert.deepEqual(sanitizePermissions(["sensitive:view", "sensitive:delete"]), ["sensitive:view"]);
  assert.ok(MODULES.some((m) => m.key === "sensitive"));
  for (const p of ROLE_PRESETS) assert.equal(p.permissions.includes("sensitive:view"), false, p.name);
  for (const p of ROLE_PRESETS) assert.equal(p.permissions.some((k) => k.startsWith("mycompanies:")), false, p.name);
});

test("My Companies is for admins and for roles that name it, per action", () => {
  assert.equal(canMyCompanies({ role: "BRANCH_ADMIN" }, "delete"), true);
  assert.equal(canMyCompanies(staff(["mycompanies:view"])), true);
  assert.equal(canMyCompanies(staff(["mycompanies:view"]), "edit"), false);
  assert.equal(canMyCompanies(staff(["mycompanies:view", "mycompanies:edit"]), "edit"), true);
  assert.equal(canMyCompanies(staff(["partners:view", "partners:edit", "partners.suppliers:edit"])), false);
  assert.equal(canMyCompanies(staff(null)), false);
  assert.deepEqual(sanitizePermissions(["mycompanies:view", "mycompanies:approve", "mycompanies:export"]), ["mycompanies:view"]);
});
