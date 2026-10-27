import { test } from "node:test";
import assert from "node:assert/strict";
import { allowedKinds } from "./approvals";

test("the platform owner has nothing to approve, a company admin has", () => {
  assert.deepEqual(allowedKinds({ role: "SUPER_ADMIN", permissions: null }), []);
  assert.ok(allowedKinds({ role: "BRANCH_ADMIN", permissions: null }).length > 0);
});
