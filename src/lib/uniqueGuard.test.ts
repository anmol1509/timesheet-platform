import test from "node:test";
import assert from "node:assert/strict";
import { guardUnique, isUniqueClash, uniqueClashMessage } from "./uniqueGuard";

const burj = { code: "P2002", meta: { modelName: "Project", driverAdapterError: { cause: { constraint: { fields: ["code"] } } } } };

test("recognises a duplicate refused by the database", () => {
  assert.equal(isUniqueClash(burj), true);
  assert.equal(isUniqueClash(new Error("boom")), false);
  assert.equal(isUniqueClash(null), false);
});

test("says what and which field in plain words, and falls back when it cannot tell", () => {
  assert.equal(uniqueClashMessage(burj), "Another project already uses that code. Change it and try again.");
  assert.equal(uniqueClashMessage({ code: "P2002", meta: { modelName: "Employee", target: ["employeeIdNo"] } }), "Another employee already uses that employee ID. Change it and try again.");
  assert.equal(uniqueClashMessage({ code: "P2002", meta: {} }), "Another record already has one of these values. Change it and try again.");
});

test("turns a clash into a result and lets every other error through", async () => {
  assert.deepEqual(await guardUnique(async () => { throw burj; }, (error) => ({ error })), { error: "Another project already uses that code. Change it and try again." });
  assert.equal(await guardUnique(async () => "ok", () => "failed"), "ok");
  await assert.rejects(guardUnique(async () => { throw new Error("other"); }, () => "failed"), /other/);
});
