import test from "node:test";
import assert from "node:assert/strict";
import { normalise, planRevert, type FieldInfo } from "./auditRevertPlan";

const fields: Record<string, FieldInfo> = {
  name: { name: "name", kind: "scalar", type: "String", isRequired: true },
  mobileNumber: { name: "mobileNumber", kind: "scalar", type: "String" },
  visaExpiry: { name: "visaExpiry", kind: "scalar", type: "DateTime" },
  basicSalary: { name: "basicSalary", kind: "scalar", type: "Decimal" },
  status: { name: "status", kind: "scalar", type: "String", isRequired: true },
  photoData: { name: "photoData", kind: "scalar", type: "Bytes" },
  supplier: { name: "supplier", kind: "object", type: "Supplier" },
};
const pay = { canSeePay: true };

test("a field still holding what the edit wrote goes back to the old value", () => {
  const p = planRevert({ mobileNumber: { from: "0501111111", to: "0502222222" } }, { mobileNumber: "0502222222" }, fields, pay);
  assert.equal(p.fields[0].status, "ok");
  assert.equal(p.fields[0].value, "0501111111");
});

test("a field edited again since is left alone", () => {
  const p = planRevert({ mobileNumber: { from: "0501111111", to: "0502222222" } }, { mobileNumber: "0509999999" }, fields, pay);
  assert.equal(p.fields[0].status, "changed");
  assert.match(p.problem ?? "", /edited again/);
});

test("dates compare by moment, whatever the column returns", () => {
  const p = planRevert({ visaExpiry: { from: "2026-01-01T00:00:00.000Z", to: "2027-01-01T00:00:00.000Z" } }, { visaExpiry: new Date("2027-01-01T00:00:00.000Z") }, fields, pay);
  assert.equal(p.fields[0].status, "ok");
  assert.ok(p.fields[0].value instanceof Date);
  assert.equal((p.fields[0].value as Date).toISOString(), "2026-01-01T00:00:00.000Z");
});

test("decimals compare as numbers", () => {
  assert.equal(normalise("3200.00", "Decimal"), normalise(3200, "Decimal"));
  const p = planRevert({ basicSalary: { from: 3000, to: 3200 } }, { basicSalary: "3200.00" }, fields, pay);
  assert.equal(p.fields[0].status, "ok");
});

test("pay figures are skipped for people without payroll access", () => {
  const p = planRevert({ basicSalary: { from: 3000, to: 3200 } }, { basicSalary: 3200 }, fields, { canSeePay: false });
  assert.equal(p.fields[0].status, "skipped");
  assert.ok(p.problem);
});

test("workflow fields, files and relations are never written back", () => {
  const p = planRevert({ status: { from: "ACTIVE", to: "TERMINATED" }, photoData: { from: null, to: "x" }, supplier: { from: "a", to: "b" } }, { status: "TERMINATED", photoData: "x", supplier: "b" }, fields, pay);
  assert.ok(p.fields.every((f) => f.status === "skipped"));
  assert.ok(p.problem);
});

test("only the matching fields of a mixed edit go back", () => {
  const p = planRevert(
    { name: { from: "Rahul", to: "Rahul Khan" }, mobileNumber: { from: null, to: "0501234567" } },
    { name: "Rahul Khan Jr", mobileNumber: "0501234567" },
    fields,
    pay,
  );
  assert.deepEqual(p.fields.map((f) => f.status), ["changed", "ok"]);
  assert.equal(p.problem, undefined);
});

test("an entry with no field changes has nothing to put back", () => {
  assert.ok(planRevert({}, {}, fields, pay).problem);
});
