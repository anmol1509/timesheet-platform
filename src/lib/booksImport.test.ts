import test from "node:test";
import assert from "node:assert/strict";
import { guessType, matchAccount, parseAmount, parseCsv, parseTrialBalance } from "./books/importTb";

test("amounts: commas, brackets, Dr/Cr suffix, currency", () => {
  assert.equal(parseAmount("1,234.50"), 1234.5);
  assert.equal(parseAmount("(1,234.50)"), -1234.5);
  assert.equal(parseAmount("AED 500 Dr"), 500);
  assert.equal(parseAmount("750.00 Cr"), -750);
  assert.equal(parseAmount("abc"), null);
  assert.equal(parseAmount(""), null);
});

test("Tally trial balance: title rows, particulars, debit/credit, grand total", () => {
  const grid = [
    ["Gulf Manpower LLC"], ["Trial Balance"], ["1-Apr-26 to 30-Sep-26"], [],
    ["Particulars", "Debit", "Credit"],
    ["Capital Account", "", "100,000.00"],
    ["Sundry Debtors", "60,000.00", ""],
    ["Sundry Creditors", "", "20,000.00"],
    ["Salaries", "60,000.00", ""],
    ["Grand Total", "120,000.00", "120,000.00"],
  ];
  const r = parseTrialBalance(grid);
  assert.equal(r.error, undefined);
  assert.deepEqual(r.rows.map((x) => [x.name, x.debit, x.credit]), [["Capital Account", 0, 100000], ["Sundry Debtors", 60000, 0], ["Sundry Creditors", 0, 20000], ["Salaries", 60000, 0]]);
  assert.equal(r.sourceDebit, 120000);
});

test("Zoho style: account code and type columns", () => {
  const r = parseTrialBalance([["Account", "Account Code", "Account Type", "Debit", "Credit"], ["Petty Cash", "1010", "Cash", 500, 0], ["Sales", "4100", "Income", 0, 500], ["Total", "", "", 500, 500]]);
  assert.deepEqual(r.rows.map((x) => [x.name, x.code, x.debit, x.credit]), [["Petty Cash", "1010", 500, 0], ["Sales", "4100", 0, 500]]);
});

test("single balance column with Dr/Cr", () => {
  const r = parseTrialBalance([["Ledger", "Closing Balance"], ["HDFC Bank", "10,000 Dr"], ["Loan", "10,000 Cr"]]);
  assert.deepEqual(r.rows.map((x) => [x.debit, x.credit]), [[10000, 0], [0, 10000]]);
});

test("no debit/credit columns gives a clear error", () => {
  assert.match(parseTrialBalance([["a", "b"], ["x", "y"]]).error ?? "", /Debit and Credit/);
});

test("csv with quotes", () => {
  assert.deepEqual(parseCsv('Name,Debit\n"Rent, office","1,000"\r\n'), [["Name", "Debit"], ["Rent, office", "1,000"]]);
});

test("matching a source ledger to our chart, and guessing a type for the rest", () => {
  const chart = [{ id: "1", code: "1100", name: "Bank — main account", type: "ASSET", tag: "BANK" }, { id: "2", code: "2100", name: "Accounts payable", type: "LIABILITY", tag: "PAYABLE" }, { id: "3", code: "5100", name: "Salaries & wages", type: "EXPENSE", tag: "SALARIES" }, { id: "4", code: "1200", name: "Accounts receivable", type: "ASSET", tag: "RECEIVABLE" }];
  assert.equal(matchAccount({ name: "Salaries and Wages", debit: 1, credit: 0 }, chart)?.id, "3");
  assert.equal(matchAccount({ name: "Anything", code: "2100", debit: 0, credit: 1 }, chart)?.id, "2");
  assert.equal(matchAccount({ name: "Emirates NBD current", debit: 1, credit: 0 }, chart), null);
  assert.equal(matchAccount({ name: "Sundry Debtors", debit: 1, credit: 0 }, chart)?.id, "4");
  assert.equal(matchAccount({ name: "Sundry Creditors", debit: 0, credit: 1 }, chart)?.id, "2");
  assert.equal(matchAccount({ name: "Bank A/c", debit: 1, credit: 0 }, chart)?.id, "1");
  assert.equal(matchAccount({ name: "Emirates NBD Bank A/c", debit: 1, credit: 0 }, chart), null);
  assert.equal(guessType({ name: "Emirates NBD Bank A/c", debit: 5, credit: 0 }), "ASSET");
  assert.equal(guessType({ name: "Sundry Creditors", debit: 0, credit: 5 }), "LIABILITY");
  assert.equal(guessType({ name: "Share Capital", debit: 0, credit: 5 }), "EQUITY");
  assert.equal(guessType({ name: "Office Rent", debit: 5, credit: 0 }), "EXPENSE");
  assert.equal(guessType({ name: "Service Revenue", debit: 0, credit: 5 }), "INCOME");
});
