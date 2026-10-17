import test from "node:test";
import assert from "node:assert/strict";
import { billPostings, expensePostings, hashPosting, invoicePostings, loanPostings, monthEnd, payrollPostings, topUpPostings, totals, type Posting } from "./postings";
import { DEFAULT_CHART, expenseTagFor } from "./chart";
import { isLocked, netProfit, normalBalance, runningBalance, trialBalance } from "./ledger";

const d = (s: string) => new Date(`${s}T00:00:00.000Z`);
const balanced = (ps: Posting[]) => ps.every((p) => totals(p.lines).balanced);

test("the default chart has every account the postings need, with unique codes", () => {
  const tags = new Set(DEFAULT_CHART.map((c) => c.tag));
  for (const t of ["CASH", "BANK", "RECEIVABLE", "PAYABLE", "VAT_INPUT", "VAT_OUTPUT", "STAFF_ADVANCES", "ACCRUED_SALARIES", "DUE_TO_STAFF", "INCOME_SALES", "SALARIES", "COST_SUPPLIERS", "EXPENSE_OTHER", "OPENING_EQUITY"]) assert.ok(tags.has(t), t);
  assert.equal(new Set(DEFAULT_CHART.map((c) => c.code)).size, DEFAULT_CHART.length);
  for (const cat of ["Accommodation rent", "Transport & fuel", "Vehicle maintenance", "Food & catering", "PPE & safety", "Visa & immigration fees", "Medical & insurance", "Utilities", "Office & admin", "Other", "Something new"]) assert.ok(tags.has(expenseTagFor(cat)), cat);
});

test("an issued invoice debits receivables and splits income from VAT; a draft posts nothing", () => {
  const inv = { id: "i1", invoiceNumber: "INV-1", clientId: "c1", clientName: "Emaar", status: "SENT", issueDate: d("2026-10-15"), paidDate: null, subtotal: 100, vatAmount: 5, totalAmount: 105 };
  const [sales] = invoicePostings(inv);
  assert.deepEqual(sales.lines.map((l) => [l.tag, l.debit ?? 0, l.credit ?? 0]), [["RECEIVABLE", 105, 0], ["INCOME_SALES", 0, 100], ["VAT_OUTPUT", 0, 5]]);
  assert.equal(invoicePostings({ ...inv, status: "DRAFT" }).length, 0);
  const paid = invoicePostings({ ...inv, status: "PAID", paidDate: d("2026-10-20") });
  assert.equal(paid.length, 2);
  assert.ok(balanced(paid));
  assert.equal(paid[1].date.toISOString().slice(0, 10), "2026-10-20");
});

test("a rounding gap between subtotal and total never unbalances an invoice", () => {
  const [p] = invoicePostings({ id: "i", invoiceNumber: "X", clientId: "c", clientName: "C", status: "SENT", issueDate: d("2026-10-01"), paidDate: null, subtotal: 100.01, vatAmount: 5, totalAmount: 105 });
  assert.ok(totals(p.lines).balanced);
});

test("an approved bill posts cost and input VAT against payables; payments clear it; a credit cancels cost", () => {
  const bill = { id: "b1", billNo: "GM-1", supplierId: "s1", supplierName: "Gulf", billDate: d("2026-10-01"), amount: 1000, vatAmount: 50, approvalStatus: "APPROVED", payments: [
    { id: "p1", paidOn: d("2026-10-10"), amount: 500, method: "BANK", reference: null },
    { id: "p2", paidOn: d("2026-10-11"), amount: 100, method: "CASH", reference: null },
    { id: "p3", paidOn: d("2026-10-12"), amount: 50, method: "CREDIT", reference: "short delivery" },
  ] };
  const ps = billPostings(bill);
  assert.equal(ps.length, 4);
  assert.ok(balanced(ps));
  assert.equal(ps[0].lines.find((l) => l.tag === "PAYABLE")?.credit, 1050);
  assert.equal(ps[1].lines[1].tag, "BANK");
  assert.equal(ps[2].lines[1].tag, "CASH");
  assert.equal(ps[3].lines[1].tag, "COST_SUPPLIERS");
  assert.equal(billPostings({ ...bill, approvalStatus: "PENDING" }).length, 0);
});

test("expenses: category account, cash vs bank, out-of-pocket owed to staff then reimbursed, advances are assets", () => {
  const e = { id: "e1", date: d("2026-10-03"), category: "Transport & fuel", description: "Fuel", amount: 100, vatAmount: 5, paidTo: null, paymentMethod: "CASH", outOfPocket: false, reimbursedAt: null, projectId: "pr1", status: "APPROVED" };
  const [a] = expensePostings(e);
  assert.deepEqual(a.lines.map((l) => l.tag), ["EXP_TRANSPORT", "VAT_INPUT", "CASH"]);
  assert.equal(a.lines[0].projectId, "pr1");
  const oop = expensePostings({ ...e, outOfPocket: true, reimbursedAt: d("2026-10-09") });
  assert.equal(oop.length, 2);
  assert.equal(oop[0].lines[2].tag, "DUE_TO_STAFF");
  assert.ok(balanced(oop));
  assert.equal(expensePostings({ ...e, category: "Salaries advance" })[0].lines[0].tag, "STAFF_ADVANCES");
  assert.equal(expensePostings({ ...e, status: "PENDING" }).length, 0);
});

test("payroll: expense is net plus loans recovered; accrued until paid; projects keep their cost", () => {
  const run = { id: "r1", month: "2026-09", status: "APPROVED", approvedAt: d("2026-10-02"), paidAt: null, label: "Al Noor", lines: [
    { net: 900, loanDeduction: 100, paymentStatus: "PENDING", projectId: "p1" },
    { net: 800, loanDeduction: 0, paymentStatus: "PAID", projectId: "p2" },
    { net: 300, loanDeduction: 0, paymentStatus: "PENDING", projectId: null },
  ] };
  const ps = payrollPostings(run);
  assert.equal(ps.length, 2);
  assert.ok(balanced(ps));
  assert.equal(ps[0].date.toISOString().slice(0, 10), "2026-09-30");
  assert.equal(ps[0].lines.filter((l) => l.tag === "SALARIES").reduce((s, l) => s + (l.debit ?? 0), 0), 2100);
  assert.equal(ps[0].lines.find((l) => l.tag === "STAFF_ADVANCES")?.credit, 100);
  assert.equal(ps[1].lines[0].debit, 800);
  const paid = payrollPostings({ ...run, status: "PAID", paidAt: d("2026-10-05") });
  assert.equal(paid[1].lines[0].debit, 2000);
  assert.equal(payrollPostings({ ...run, status: "DRAFT" }).length, 0);
});

test("loans post only once approved and handed over; top-ups move bank to cash", () => {
  const loan = { id: "l1", refNo: 1, employeeId: "emp", employeeName: "Ali", principal: 500, approvalStatus: "APPROVED", givenDate: d("2026-10-04"), method: "CASH", type: "ADVANCE" };
  assert.ok(balanced(loanPostings(loan)));
  assert.equal(loanPostings({ ...loan, givenDate: null }).length, 0);
  assert.equal(loanPostings({ ...loan, approvalStatus: "PENDING" }).length, 0);
  assert.deepEqual(topUpPostings({ id: "t", amount: 300, date: d("2026-10-01"), note: null })[0].lines.map((l) => l.tag), ["CASH", "BANK"]);
});

test("monthEnd and the fingerprint", () => {
  assert.equal(monthEnd("2026-02").toISOString().slice(0, 10), "2026-02-28");
  assert.equal(monthEnd("2028-02").toISOString().slice(0, 10), "2028-02-29");
  const p: Posting = { sourceKey: "k", date: d("2026-10-01"), type: "SALES", narration: "n", lines: [{ tag: "BANK", debit: 1 }, { tag: "CASH", credit: 1 }] };
  assert.equal(hashPosting(p), hashPosting({ ...p, sourceKey: "other" }));
  assert.notEqual(hashPosting(p), hashPosting({ ...p, lines: [{ tag: "BANK", debit: 2 }, { tag: "CASH", credit: 2 }] }));
});

test("trial balance puts each net in one column and the columns agree", () => {
  const accts = [
    { id: "1", code: "1100", name: "Bank", type: "ASSET", debit: 1000, credit: 300 },
    { id: "2", code: "2100", name: "Payables", type: "LIABILITY", debit: 100, credit: 600 },
    { id: "3", code: "4100", name: "Income", type: "INCOME", debit: 0, credit: 200 },
    { id: "4", code: "5100", name: "Salaries", type: "EXPENSE", debit: 0.5 + 0.5, credit: 0 },
    { id: "5", code: "9999", name: "Unused", type: "EXPENSE", debit: 0, credit: 0 },
  ];
  const tb = trialBalance(accts);
  assert.equal(tb.rows.length, 4);
  assert.equal(tb.debit, 701);
  assert.equal(tb.credit, 700);
  assert.equal(tb.balanced, false);
  assert.equal(netProfit(accts), 199);
  assert.equal(normalBalance(accts[0]), 700);
  assert.equal(normalBalance(accts[1]), 500);
  const even = trialBalance([{ id: "1", code: "1", name: "A", type: "ASSET", debit: 50, credit: 0 }, { id: "2", code: "2", name: "B", type: "INCOME", debit: 0, credit: 50 }]);
  assert.ok(even.balanced);
});

test("running balance and the lock date", () => {
  const rows = runningBalance([
    { date: d("2026-10-01"), number: "A", narration: "", debit: 100, credit: 0 },
    { date: d("2026-10-02"), number: "B", narration: "", debit: 0, credit: 30 },
  ], 50);
  assert.deepEqual(rows.map((r) => r.balance), [150, 120]);
  assert.equal(isLocked(d("2026-09-30"), d("2026-09-30")), true);
  assert.equal(isLocked(d("2026-10-01"), d("2026-09-30")), false);
  assert.equal(isLocked(d("2026-10-01"), null), false);
});
