import { test } from "node:test";
import assert from "node:assert/strict";
import { customPostings, ruleTarget, type CustomRule, type RuleStaff } from "./customProvisions";
import { monthsBetween } from "./accruals";
import { totals } from "./postings";

const d = (s: string) => new Date(`${s}T00:00:00.000Z`);
const person = (over: Partial<RuleStaff> = {}): RuleStaff => ({ id: "e1", category: "SITE_STAFF", joinDate: d("2024-01-01"), exitDate: null, settledOn: null, basic: 2000, fixed: 3000, leaveDaysPerYear: null, ticketAmount: null, ticketEveryMonths: null, ...over });
const rule = (over: Partial<CustomRule> = {}): CustomRule => ({ id: "r1", name: "Annual bonus", method: "PER_PERSON", amount: 1200, everyMonths: 12, appliesTo: "ALL", active: true, ...over });

test("a per-person provision builds across the cycle and starts again", () => {
  const staff = [person(), person({ id: "e2" })];
  assert.equal(ruleTarget(rule(), staff, d("2026-03-31")), 600); // 2 people × 1,200 × 3/12
  assert.equal(ruleTarget(rule(), staff, d("2026-12-31")), 2400);
  assert.equal(ruleTarget(rule(), staff, d("2027-01-31")), 200); // new cycle
});

test("percent of pay, company-wide amounts, scope and a new joiner", () => {
  assert.equal(ruleTarget(rule({ method: "PERCENT", amount: 10 }), [person()], d("2026-02-28")), 600); // 10% of 3,000 × 2 months
  assert.equal(ruleTarget(rule({ method: "COMPANY", amount: 12000 }), [], d("2026-06-30")), 6000);
  assert.equal(ruleTarget(rule({ appliesTo: "STAFF" }), [person()], d("2026-06-30")), 0); // site staff are not office staff
  const joiner = person({ joinDate: d("2026-05-01") });
  assert.ok(ruleTarget(rule(), [joiner], d("2026-06-30")) < 250); // only about two months of cycle
});

test("an off rule or one with no amount accrues nothing", () => {
  assert.equal(ruleTarget(rule({ active: false }), [person()], d("2026-06-30")), 0);
  assert.equal(ruleTarget(rule({ amount: 0 }), [person()], d("2026-06-30")), 0);
});

test("month-end journals balance, honour payments, and release when the cycle restarts", () => {
  const posts = customPostings({
    months: monthsBetween("2026-10", "2027-01"), staff: [person()], rules: [rule()],
    opening: {}, used: [{ date: d("2026-12-20"), ruleId: "r1", amount: 1200 }],
  });
  for (const p of posts) assert.ok(totals(p.lines).balanced);
  const net = posts.flatMap((p) => p.lines).filter((l) => l.tag === "PROV_r1").reduce((s, l) => s + (l.credit ?? 0) - (l.debit ?? 0), 0);
  // The month-end journals must add back the 1,200 the payment took out, plus January's new-cycle 100.
  assert.equal(Math.round(net * 100) / 100, 1200 / 12 + 1200);
});
