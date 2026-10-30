import test from "node:test";
import assert from "node:assert/strict";
import { reviveRow, serialiseRow, type ColumnInfo } from "./trashSerialise";

const cols: Record<string, ColumnInfo> = {
  id: { kind: "scalar", type: "String" },
  name: { kind: "scalar", type: "String" },
  expiry: { kind: "scalar", type: "DateTime" },
  fileData: { kind: "scalar", type: "Bytes" },
  rate: { kind: "scalar", type: "Decimal" },
  count: { kind: "scalar", type: "BigInt" },
  tags: { kind: "scalar", type: "Json" },
  note: { kind: "scalar", type: "String" },
  supplier: { kind: "object", type: "Supplier" },
};

test("a row survives being turned into JSON and back, files and dates included", () => {
  const row = { id: "d1", name: "Passport", expiry: new Date("2027-01-02T00:00:00.000Z"), fileData: Buffer.from([1, 2, 3, 255]), rate: "12.50", count: BigInt(5), tags: { a: [1, 2] }, note: null, supplier: { id: "s" } };
  const json = serialiseRow(row, cols);
  const back = reviveRow(JSON.parse(JSON.stringify(json)), cols);
  assert.equal(back.name, "Passport");
  assert.equal((back.expiry as Date).toISOString(), "2027-01-02T00:00:00.000Z");
  assert.deepEqual([...(back.fileData as Buffer)], [1, 2, 3, 255]);
  assert.equal(back.rate, "12.50");
  assert.equal(back.count, BigInt(5));
  assert.deepEqual(back.tags, { a: [1, 2] });
  assert.equal(back.note, null);
  assert.ok(!("supplier" in back));
});

test("columns the table no longer has are dropped when restoring", () => {
  assert.deepEqual(reviveRow({ id: "x", gone: 1 }, cols), { id: "x" });
});
