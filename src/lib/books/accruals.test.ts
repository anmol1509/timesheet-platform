import { test } from "node:test";
import assert from "node:assert/strict";
import { accrualPostings, gratuityEarned, monthsBetween, provisionAt, type StaffFacts } from "./accruals";
import { settlementPostings, totals } from "./postings";

const d = (s: string) => new Date(`${s}T00:00:00.000Z`);
const person = (over: Partial<StaffFacts> = {}): StaffFacts => ({ id: "e1", joinDate: d("2025-01-01"), exitDate: null, settledOn: null, basic: 3000, fixed: 3000, leaveDaysPerYear: 30, ticketAmount: 1200, ticketEveryMonths: 24, ...over });
const all = { gratuity: true, leave: true, tickets: true };

test("gratuity is earned from day one at 21 days a year", () => {
  assert.equal(gratuityEarned(3000, 0.5), 1050); // 21 × 100 × 0.5
  assert.equal(gratuityEarned(3000, 1), 2100);
  assert.equal(gratuityEarned(0, 3), 0);
});

test("leave builds to one year's entitlement and tickets build across the cycle", () => {
  const half = provisionAt(person({ joinDate: d("2026-01-01") }), d("2026-07-02"), all);
  assert.ok(half.leave > 1400 && half.leave < 1600); // about half of 30 days at 100/day
  const later = provisionAt(person(), d("2027-06-30"), all);
  assert.equal(later.leave, 3000); // capped at a year's 30 days
  assert.ok(later.tickets > 290 && later.tickets < 310); // about 6 of 24 months into the second cycle
});

test("blank contract terms and switched-off items accrue nothing", () => {
  const p = provisionAt(person({ leaveDaysPerYear: null, ticketAmount: null }), d("2026-06-30"), all);
  assert.equal(p.leave, 0);
  assert.equal(p.tickets, 0);
  assert.equal(provisionAt(person(), d("2026-06-30"), { gratuity: false, leave: false, tickets: false }).gratuity, 0);
});

test("a settled leaver stops accruing", () => {
  assert.equal(provisionAt(person({ settledOn: d("2026-03-15") }), d("2026-03-31"), all).gratuity, 0);
});

test("monthly journal brings each provision up to target and balances", () => {
  const months = monthsBetween("2026-01", "2026-03");
  const posts = accrualPostings({ months, staff: [person({ joinDate: d("2026-01-01") })], on: { gratuity: true, leave: false, tickets: false }, opening: { gratuity: 0, leave: 0, tickets: 0 }, used: [] });
  assert.equal(posts.length, 3);
  for (const p of posts) assert.ok(totals(p.lines).balanced);
  const credit = posts.flatMap((p) => p.lines).filter((l) => l.tag === "EOSB").reduce((s, l) => s + (l.credit ?? 0) - (l.debit ?? 0), 0);
  assert.equal(Math.round(credit * 100) / 100, provisionAt(person({ joinDate: d("2026-01-01") }), d("2026-03-31"), all).gratuity);
});

test("opening balance and a paid settlement are respected, and the leaver's remainder is released", () => {
  const staff = [person({ joinDate: d("2025-01-01"), exitDate: d("2026-02-10"), settledOn: d("2026-02-20") })];
  const posts = accrualPostings({
    months: monthsBetween("2026-01", "2026-03"), staff, on: { gratuity: true, leave: false, tickets: false },
    opening: { gratuity: 2500, leave: 0, tickets: 0 }, used: [{ date: d("2026-02-20"), amounts: { gratuity: 2300 } }],
  });
  // Net effect on the provision across all months must leave it at zero once the person is settled.
  const net = posts.flatMap((p) => p.lines).filter((l) => l.tag === "EOSB").reduce((s, l) => s + (l.credit ?? 0) - (l.debit ?? 0), 0);
  assert.equal(Math.round((2500 + net - 2300) * 100) / 100, 0);
});

test("a paid settlement posts balanced lines, with the bank paying the net", () => {
  const [p] = settlementPostings({ id: "s1", employeeId: "e1", employeeName: "Ali", status: "PAID", paidAt: d("2026-03-01"), gratuity: 2100, unpaidSalary: 500, leavePay: 300, noticePay: 0, otherEarnings: 0, loanBalance: 400, otherDeductions: 0, fromGratuityProvision: true, fromLeaveProvision: false });
  assert.ok(totals(p.lines).balanced);
  assert.equal(p.lines.find((l) => l.tag === "BANK")?.credit, 2500);
  assert.ok(p.lines.some((l) => l.tag === "EOSB" && l.debit === 2100));
  assert.equal(p.lines.filter((l) => l.tag === "SALARIES").reduce((n, l) => n + (l.debit ?? 0), 0), 800); // unpaid salary plus leave charged straight to cost
  assert.deepEqual(settlementPostings({ id: "s2", employeeId: "e1", employeeName: "Ali", status: "DRAFT", paidAt: null, gratuity: 1, unpaidSalary: 0, leavePay: 0, noticePay: 0, otherEarnings: 0, loanBalance: 0, otherDeductions: 0, fromGratuityProvision: false, fromLeaveProvision: false }), []);
});
