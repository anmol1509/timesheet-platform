import { test } from "node:test";
import assert from "node:assert/strict";
import { closingLines } from "./closing";
import { totals } from "./postings";

test("income and costs are zeroed and the profit moves to retained earnings", () => {
  const { lines, profit } = closingLines([
    { id: "sales", type: "INCOME", debit: 0, credit: 10000 },
    { id: "salaries", type: "EXPENSE", debit: 6000, credit: 0 },
    { id: "rent", type: "EXPENSE", debit: 1500, credit: 200 },
    { id: "bank", type: "ASSET", debit: 5000, credit: 0 },
  ], "re");
  assert.equal(profit, 2700);
  assert.ok(totals(lines).balanced);
  assert.deepEqual(lines.find((l) => l.accountId === "re"), { accountId: "re", debit: 0, credit: 2700 });
  assert.equal(lines.some((l) => l.accountId === "bank"), false);
});

test("a loss debits retained earnings and an empty year posts nothing", () => {
  const loss = closingLines([{ id: "sales", type: "INCOME", debit: 0, credit: 1000 }, { id: "cost", type: "EXPENSE", debit: 3000, credit: 0 }], "re");
  assert.equal(loss.profit, -2000);
  assert.deepEqual(loss.lines.find((l) => l.accountId === "re"), { accountId: "re", debit: 2000, credit: 0 });
  assert.ok(totals(loss.lines).balanced);
  assert.deepEqual(closingLines([{ id: "bank", type: "ASSET", debit: 1, credit: 0 }], "re"), { lines: [], profit: 0 });
});
