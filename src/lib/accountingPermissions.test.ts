import test from "node:test";
import assert from "node:assert/strict";
import { ROLE_PRESETS, can, canViewPath, canWrite } from "./permissions";

const staff = (permissions: string[] | null) => ({ role: "STAFF", permissions });

test("a finance-wide grant reaches Accounting; a page-level grant on bills or expenses does not", () => {
  assert.equal(can(staff(["finance:view"]), "finance.books", "view"), true);
  assert.equal(can(staff(["finance.bills:view", "finance.expenses:view"]), "finance.books", "view"), false);
  assert.equal(canViewPath(staff(["finance.bills:view"]), "/finance/books"), false);
  assert.equal(canViewPath(staff(["finance.books:view"]), "/finance/books"), true);
});

test("the Accounting import and bank APIs follow the same grant", () => {
  assert.equal(canViewPath(staff(["finance.bills:view"]), "/api/books/parse"), false);
  assert.equal(canViewPath(staff(["finance:view"]), "/api/books/parse"), true);
});

test("view access does not let someone post; edit access does", () => {
  assert.equal(canWrite(staff(["finance:view"]), "finance.books"), false);
  assert.equal(canWrite(staff(["finance:view", "finance:edit"]), "finance.books"), true);
});

test("the Accountant preset can work in Accounting and the Viewer preset can read it", () => {
  const accountant = staff(ROLE_PRESETS.find((p) => p.name === "Accountant")!.permissions);
  assert.equal(can(accountant, "finance.books", "view"), true);
  assert.equal(canWrite(accountant, "finance.books"), true);
  assert.equal(can(accountant, "finance.books", "delete"), false);
  const viewer = staff(ROLE_PRESETS.find((p) => p.name === "Viewer")!.permissions);
  assert.equal(can(viewer, "finance.books", "view"), true);
  assert.equal(canWrite(viewer, "finance.books"), false);
});

test("a staff user with no role keeps full access, as before", () => {
  assert.equal(can(staff(null), "finance.books", "view"), true);
});
