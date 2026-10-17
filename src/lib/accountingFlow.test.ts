import test from "node:test";
import assert from "node:assert/strict";
import { entryFlow } from "./books/flow";

const L = (money: boolean, debit: number, credit: number) => ({ money, debit, credit });

test("cash received is money in; cash paid is money out", () => {
  assert.deepEqual(entryFlow("RECEIPT", [L(true, 2000, 0), L(false, 0, 2000)]), { amount: 2000, direction: "in", cash: true });
  assert.deepEqual(entryFlow("PAYMENT", [L(false, 9200, 0), L(true, 0, 9200)]), { amount: 9200, direction: "out", cash: true });
});

test("an invoice or bill that has not moved cash is shown on its side, marked as not cash", () => {
  assert.deepEqual(entryFlow("SALES", [L(false, 94500, 0), L(false, 0, 90000), L(false, 0, 4500)]), { amount: 94500, direction: "in", cash: false });
  assert.deepEqual(entryFlow("BILL", [L(false, 19320, 0), L(false, 0, 19320)]), { amount: 19320, direction: "out", cash: false });
  assert.equal(entryFlow("CREDIT_NOTE", [L(false, 1050, 0), L(false, 0, 1050)]).direction, "out");
  assert.equal(entryFlow("DEBIT_NOTE", [L(false, 1050, 0), L(false, 0, 1050)]).direction, "in");
});

test("a journal that moves no cash is neither; a transfer between two bank accounts nets to nothing", () => {
  assert.deepEqual(entryFlow("JOURNAL", [L(false, 4200, 0), L(false, 0, 4200)]), { amount: 4200, direction: null, cash: false });
  assert.equal(entryFlow("JOURNAL", [L(true, 500, 0), L(true, 0, 500)]).direction, null);
});

test("an expense paid in cash is money out and counts as cash", () => {
  assert.deepEqual(entryFlow("EXPENSE", [L(false, 1260, 0), L(true, 0, 1260)]), { amount: 1260, direction: "out", cash: true });
});
