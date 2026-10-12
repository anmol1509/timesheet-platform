import test from "node:test";
import assert from "node:assert/strict";
import { EMPLOYEE_DOC_TYPES, SUPPLIER_DOC_TYPE_OPTIONS } from "./importer/documentMatch";

test("a profile picture can be chosen as a worker document type, but not for companies", () => {
  assert.ok(EMPLOYEE_DOC_TYPES.some((t) => t.value === "PHOTO" && t.label === "Profile picture"));
  assert.ok(!SUPPLIER_DOC_TYPE_OPTIONS.some((t) => t.value === "PHOTO"));
});
