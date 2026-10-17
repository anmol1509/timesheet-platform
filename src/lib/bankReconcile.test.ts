import test from "node:test";
import assert from "node:assert/strict";
import { lineHashes, parseBankStatement, parseStatementDate } from "./books/bankStatement";
import { suggestMatches } from "./books/reconcile";

test("statement dates: day-first, month names, ISO, Excel serials", () => {
  assert.equal(parseStatementDate("05/10/2026"), "2026-10-05");
  assert.equal(parseStatementDate("5-Oct-2026"), "2026-10-05");
  assert.equal(parseStatementDate("2026-10-05"), "2026-10-05");
  assert.equal(parseStatementDate(46300), "2026-10-05");
  assert.equal(parseStatementDate("31/02/2026"), null);
  assert.equal(parseStatementDate("Opening balance"), null);
});

test("withdrawal / deposit statement: signs, skipped rows, balances", () => {
  const r = parseBankStatement([
    ["Account Statement"], ["Date", "Description", "Cheque No", "Withdrawal", "Deposit", "Balance"],
    ["01/10/2026", "Opening balance", "", "", "", "10,000.00"],
    ["02/10/2026", "SALARY TRANSFER AL NOOR", "", "5,000.00", "", "5,000.00"],
    ["03/10/2026", "EMAAR CONSTRUCTION INV-9", "123", "", "94,500.00", "99,500.00"],
    ["04/10/2026", "Bank charges", "", "26.25", "", "99,473.75"],
  ]);
  assert.equal(r.error, undefined);
  assert.deepEqual(r.lines.map((l) => [l.date, l.amount]), [["2026-10-02", -5000], ["2026-10-03", 94500], ["2026-10-04", -26.25]]);
  assert.equal(r.lines[1].reference, "123");
  assert.equal(r.lines[2].balance, 99473.75);
  assert.equal(r.skipped, 1);
});

test("single signed amount column", () => {
  const r = parseBankStatement([["Date", "Narration", "Amount"], ["2026-10-02", "Rent", "-3000"], ["2026-10-03", "Receipt", "(0)"], ["2026-10-04", "Sales", "1,500.50"]]);
  assert.deepEqual(r.lines.map((l) => l.amount), [-3000, 1500.5]);
});

test("no recognisable columns gives a clear error", () => {
  assert.match(parseBankStatement([["a", "b"], ["1", "2"]]).error ?? "", /Date column/);
});

test("identical lines on one day get distinct hashes; re-reading gives the same ones", () => {
  const l = { date: "2026-10-02", description: "ATM", amount: -500 };
  const h = lineHashes([l, l]);
  assert.notEqual(h[0], h[1]);
  assert.deepEqual(lineHashes([l, l]), h);
});

test("matching: same amount and direction, closest date, each entry once; a shared word makes it exact", () => {
  const stmt = [
    { id: "s1", date: "2026-10-03", description: "EMAAR CONSTRUCTION INV-9", amount: 94500 },
    { id: "s2", date: "2026-10-04", description: "Bank charges", amount: -26.25 },
    { id: "s3", date: "2026-10-05", description: "Unknown", amount: -100 },
    { id: "s4", date: "2026-10-06", description: "Unknown", amount: 500 },
  ];
  const ledger = [
    { entryId: "e1", date: "2026-10-01", narration: "Emaar Construction LLC — invoice INV-9 received", number: "SR-0001", amount: 94500 },
    { entryId: "e2", date: "2026-10-04", narration: "Printer", number: "EX-0002", amount: -100 },
    { entryId: "e3", date: "2026-09-01", narration: "Old", number: "EX-0001", amount: 500 },
  ];
  const m = suggestMatches(stmt, ledger);
  assert.deepEqual(m.map((x) => [x.statementId, x.entryId, x.confidence]), [["s1", "e1", "exact"], ["s3", "e2", "likely"]]);
});
