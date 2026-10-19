import { test } from "node:test";
import assert from "node:assert/strict";
import { ageParties, ageTotals, termsDays } from "./ageing";
import { cashFlow } from "./cashflow";
import { profitByClient } from "./projectProfit";

const d = (s: string) => new Date(`${s}T00:00:00.000Z`);

test("terms are read from text", () => {
  assert.equal(termsDays("Net 45"), 45);
  assert.equal(termsDays(null), 30);
});

test("payments settle the oldest invoice first and the rest is aged from due date", () => {
  const rows = ageParties(
    [
      { date: d("2026-05-01"), debit: 1000, credit: 0, partyId: "a" },
      { date: d("2026-09-01"), debit: 500, credit: 0, partyId: "a" },
      { date: d("2026-06-01"), debit: 0, credit: 1000, partyId: "a" },
    ],
    d("2026-10-19"), "debit", () => 30,
  );
  assert.equal(rows.length, 1);
  assert.equal(rows[0].total, 500);
  assert.equal(rows[0].buckets.d30, 500); // due 1 Oct, 18 days late
  assert.equal(ageTotals(rows).total, 500);
});

test("overpayment shows as unapplied and payables age on credit", () => {
  const ap = ageParties([{ date: d("2026-01-01"), debit: 0, credit: 800, partyId: "s" }], d("2026-10-19"), "credit", () => 30);
  assert.equal(ap[0].buckets.over, 800);
  const adv = ageParties([{ date: d("2026-01-01"), debit: 0, credit: 300, partyId: "c" }], d("2026-10-19"), "debit", () => 30);
  assert.equal(adv[0].unapplied, 300);
  assert.equal(adv[0].total, -300);
});

test("cash flow groups money movements and ignores transfers", () => {
  const m = (debit: number, credit: number) => ({ money: true, debit, credit, accountType: "ASSET", tag: "BANK" });
  const cf = cashFlow([
    { type: "RECEIPT", lines: [m(1000, 0), { money: false, debit: 0, credit: 1000, accountType: "ASSET", tag: "RECEIVABLE" }] },
    { type: "PAYMENT", lines: [m(0, 400), { money: false, debit: 400, credit: 0, accountType: "LIABILITY", tag: "PAYABLE" }] },
    { type: "TRANSFER", lines: [m(200, 0), m(0, 200)] },
    { type: "JOURNAL", lines: [m(5000, 0), { money: false, debit: 0, credit: 5000, accountType: "EQUITY", tag: "CAPITAL" }] },
  ]);
  assert.equal(cf.rows.clients, 1000);
  assert.equal(cf.rows.suppliers, -400);
  assert.equal(cf.financing, 5000);
  assert.equal(cf.net, 5600);
});

test("profit by client rolls project costs up and keeps company costs apart", () => {
  const r = profitByClient(
    [
      { lines: [{ accountType: "ASSET", tag: "RECEIVABLE", debit: 1050, credit: 0, partyType: "CLIENT", partyId: "c1", projectId: null }, { accountType: "INCOME", tag: "INCOME_SALES", debit: 0, credit: 1000, partyType: null, partyId: null, projectId: null }] },
      { lines: [{ accountType: "EXPENSE", tag: "SALARIES", debit: 600, credit: 0, partyType: null, partyId: null, projectId: "p1" }] },
      { lines: [{ accountType: "EXPENSE", tag: "EXP_OFFICE", debit: 50, credit: 0, partyType: null, partyId: null, projectId: null }] },
    ],
    () => "c1",
  );
  assert.equal(r.revenue, 1000);
  assert.equal(r.projectCosts, 600);
  assert.equal(r.companyCosts, 50);
  assert.equal(r.profit, 350);
});
