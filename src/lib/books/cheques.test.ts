import { test } from "node:test";
import assert from "node:assert/strict";
import { chequePostings, summariseCheques, type ChequeFacts } from "./cheques";
import { occurrences, recurringPostings } from "./recurring";
import { totals } from "./postings";

const d = (s: string) => new Date(`${s}T00:00:00.000Z`);
const cheque = (over: Partial<ChequeFacts> = {}): ChequeFacts => ({ id: "c1", direction: "RECEIVED", number: "000123", amount: 5000, partyType: "CLIENT", partyId: "cl1", partyName: "Emaar", bankId: "b1", counterAccountId: null, narration: null, status: "CLEARED", clearedOn: d("2026-05-02"), ...over });

test("only a cleared cheque posts", () => {
  for (const status of ["PENDING", "BOUNCED", "CANCELLED"]) assert.deepEqual(chequePostings(cheque({ status })), []);
  assert.deepEqual(chequePostings(cheque({ clearedOn: null })), []);
});

test("received and issued cheques move the bank against the right party", () => {
  const [rec] = chequePostings(cheque());
  assert.ok(totals(rec.lines).balanced);
  assert.equal(rec.lines[0].bankId, "b1");
  assert.equal(rec.lines[1].tag, "RECEIVABLE");
  assert.equal(rec.lines[1].partyId, "cl1");
  const [iss] = chequePostings(cheque({ direction: "ISSUED", partyType: "SUPPLIER", partyId: "s1" }));
  assert.equal(iss.lines[0].tag, "PAYABLE");
  assert.equal(iss.lines[1].credit, 5000);
  const [other] = chequePostings(cheque({ partyType: "OTHER", partyId: null, counterAccountId: "acc9" }));
  assert.equal(other.lines[1].accountId, "acc9");
  assert.deepEqual(chequePostings(cheque({ partyType: "OTHER", counterAccountId: null })), []);
});

test("the register counts post-dated cheques and what is due", () => {
  const s = summariseCheques([
    { direction: "RECEIVED", status: "PENDING", amount: 1000, chequeDate: d("2026-10-22") },
    { direction: "RECEIVED", status: "PENDING", amount: 500, chequeDate: d("2026-12-01") },
    { direction: "ISSUED", status: "PENDING", amount: 700, chequeDate: d("2026-10-01") },
    { direction: "ISSUED", status: "CLEARED", amount: 9999, chequeDate: d("2026-09-01") },
  ], d("2026-10-19"));
  assert.deepEqual(s, { pendingReceived: 1500, pendingIssued: 700, dueSoon: 1, overdue: 1 });
});

test("recurring dates step by period and shorten to month-end", () => {
  const dates = occurrences({ frequency: "MONTHLY", startDate: d("2026-01-31"), endDate: null }, d("2026-04-30")).map((x) => x.toISOString().slice(0, 10));
  assert.deepEqual(dates, ["2026-01-31", "2026-02-28", "2026-03-31", "2026-04-30"]);
  assert.equal(occurrences({ frequency: "QUARTERLY", startDate: d("2026-01-15"), endDate: null }, d("2026-12-31")).length, 4);
  assert.equal(occurrences({ frequency: "YEARLY", startDate: d("2024-03-01"), endDate: d("2026-03-01") }, d("2030-01-01")).length, 3);
});

test("recurring entries post from the opening date, only while active, and balance", () => {
  const r = { id: "r1", name: "Office rent", frequency: "MONTHLY" as const, startDate: d("2026-01-01"), endDate: null, debitAccountId: "rent", creditAccountId: "bank", amount: 8000, active: true };
  const posts = recurringPostings(r, d("2026-03-01"), d("2026-05-10"));
  assert.deepEqual(posts.map((p) => p.date.toISOString().slice(0, 10)), ["2026-03-01", "2026-04-01", "2026-05-01"]);
  for (const p of posts) assert.ok(totals(p.lines).balanced);
  assert.deepEqual(recurringPostings({ ...r, active: false }, d("2026-03-01"), d("2026-05-10")), []);
});
