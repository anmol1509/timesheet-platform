import { test } from "node:test";
import assert from "node:assert/strict";
import { emirateOf, quarterOf, vatReturn, type VatEntry } from "./vat";

const line = (tag: string | null, accountType: string, debit: number, credit: number) => ({ tag, accountType, debit, credit });
const sale = (net: number, vat: number): VatEntry => ({ type: "SALES", lines: [line("RECEIVABLE", "ASSET", net + vat, 0), line("INCOME_SALES", "INCOME", 0, net), ...(vat ? [line("VAT_OUTPUT", "LIABILITY", 0, vat)] : [])] });
const cost = (net: number, vat: number): VatEntry => ({ type: "BILL", lines: [line("COST_SUPPLIERS", "EXPENSE", net, 0), ...(vat ? [line("VAT_INPUT", "ASSET", vat, 0)] : []), line("PAYABLE", "LIABILITY", 0, net + vat)] });

test("standard-rated sales go in the home emirate, VAT-free sales are zero-rated", () => {
  const r = vatReturn([sale(10000, 500), sale(4000, 0), sale(2000, 100)], "Dubai");
  assert.equal(r.byEmirate.find((e) => e.emirate === "Dubai")?.amount, 12000);
  assert.equal(r.byEmirate.find((e) => e.emirate === "Dubai")?.vat, 600);
  assert.equal(r.zeroRated, 4000);
  assert.equal(r.salesTotal.amount, 16000);
  assert.equal(r.due, 600);
});

test("credit notes reduce standard-rated sales and VAT; purchases give recoverable VAT", () => {
  const credit: VatEntry = { type: "CREDIT_NOTE", lines: [line("INCOME_SALES", "INCOME", 1000, 0), line("VAT_OUTPUT", "LIABILITY", 50, 0), line("RECEIVABLE", "ASSET", 0, 1050)] };
  const r = vatReturn([sale(10000, 500), credit, cost(6000, 300), cost(1000, 0)], "Sharjah");
  assert.equal(r.byEmirate.find((e) => e.emirate === "Sharjah")?.amount, 9000);
  assert.equal(r.due, 450);
  assert.equal(r.expensesStandard.amount, 6000);
  assert.equal(r.recoverable, 300);
  assert.equal(r.net, 150);
});

test("typed reverse charge, exempt and import amounts flow into the totals; opening entries are ignored", () => {
  const opening: VatEntry = { type: "OPENING", lines: [line("INCOME_SALES", "INCOME", 0, 99999), line("VAT_OUTPUT", "LIABILITY", 0, 5000)] };
  const r = vatReturn([opening, sale(1000, 50)], "Dubai", { reverseSales: 2000, reverseExpenses: 2000, exempt: 300, importsAmount: 1000, importsVat: 50 });
  assert.equal(r.reverseSales.vat, 100);
  assert.equal(r.salesTotal.amount, 1000 + 2000 + 300 + 1000);
  assert.equal(r.salesTotal.vat, 50 + 100 + 50);
  assert.equal(r.recoverable, 100); // reverse-charge input
  assert.equal(r.net, 100);
});

test("emirate names and quarters", () => {
  assert.equal(emirateOf("ras al khaimah"), "Ras Al Khaimah");
  assert.equal(emirateOf("RAK"), "Ras Al Khaimah");
  assert.equal(emirateOf("somewhere"), "Dubai");
  const q = quarterOf(new Date(Date.UTC(2026, 10, 5)));
  assert.deepEqual([q.from, q.to, q.label], ["2026-10-01", "2026-12-31", "Q4 2026"]);
  assert.equal(quarterOf(new Date(Date.UTC(2026, 0, 10)), 1).label, "Q4 2025");
});

test("the year-end close and opening entries never count as sales", () => {
  const close: VatEntry = { type: "CLOSING", lines: [line("INCOME_SALES", "INCOME", 1000, 0), line("RETAINED_EARNINGS", "EQUITY", 0, 1000)] };
  const r = vatReturn([sale(1000, 50), close], "Dubai");
  assert.equal(r.zeroRated, 0);
  assert.equal(r.salesTotal.amount, 1000);
});
