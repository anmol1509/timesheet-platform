import test from "node:test";
import assert from "node:assert/strict";
import { addMonths, advanceRef, advanceState, amountInWords, buildRecoveryPlan, loanInstalmentFor, planRows, readSchedule, withMonthAmount } from "./advances";

test("a recovery plan in one month takes the whole amount in that month", () => {
  assert.deepEqual(buildRecoveryPlan({ mode: "ONE_MONTH", principal: 1000, month: "2026-11" }), { startMonth: "2026-11", instalment: 1000, schedule: null });
});

test("equal instalments need a sensible monthly amount", () => {
  assert.deepEqual(buildRecoveryPlan({ mode: "EQUAL", principal: 1000, startMonth: "2026-11", instalment: 250 }), { startMonth: "2026-11", instalment: 250, schedule: null });
  assert.ok("error" in buildRecoveryPlan({ mode: "EQUAL", principal: 1000, startMonth: "2026-11", instalment: 0 }));
  assert.ok("error" in buildRecoveryPlan({ mode: "EQUAL", principal: 1000, startMonth: "2026-11", instalment: 1200 }));
});

test("a month-by-month plan must add up to the amount, with no repeated month", () => {
  const ok = buildRecoveryPlan({ mode: "CUSTOM", principal: 1000, rows: [{ month: "2026-12", amount: 500 }, { month: "2026-10", amount: 300 }, { month: "2026-11", amount: 200 }] });
  assert.ok(!("error" in ok));
  if (!("error" in ok)) {
    assert.equal(ok.startMonth, "2026-10");
    assert.deepEqual(ok.schedule?.map((r) => r.month), ["2026-10", "2026-11", "2026-12"]);
  }
  assert.match((buildRecoveryPlan({ mode: "CUSTOM", principal: 1000, rows: [{ month: "2026-10", amount: 300 }] }) as { error: string }).error, /must match/);
  assert.match((buildRecoveryPlan({ mode: "CUSTOM", principal: 600, rows: [{ month: "2026-10", amount: 300 }, { month: "2026-10", amount: 300 }] }) as { error: string }).error, /twice/);
});

test("a planned advance takes that month's amount, and keeps going at the last amount after the plan", () => {
  const l = { instalment: 500, schedule: [{ month: "2026-10", amount: 300 }, { month: "2026-11", amount: 200 }, { month: "2026-12", amount: 500 }] };
  assert.equal(loanInstalmentFor(l, "2026-09"), 0);
  assert.equal(loanInstalmentFor(l, "2026-10"), 300);
  assert.equal(loanInstalmentFor(l, "2026-11"), 200);
  assert.equal(loanInstalmentFor(l, "2026-12"), 500);
  assert.equal(loanInstalmentFor(l, "2027-01"), 500);
  assert.equal(loanInstalmentFor({ instalment: 250, schedule: null }, "2027-05"), 250);
});

test("the plan shown on a receipt: equal instalments end with the remainder", () => {
  assert.deepEqual(planRows({ principal: 1000, instalment: 400, startMonth: "2026-11", schedule: null }), [
    { month: "2026-11", amount: 400 }, { month: "2026-12", amount: 400 }, { month: "2027-01", amount: 200 },
  ]);
  assert.equal(addMonths("2026-12", 1), "2027-01");
});

test("a stored schedule is read back safely", () => {
  assert.equal(readSchedule(null), null);
  assert.equal(readSchedule("junk"), null);
  assert.deepEqual(readSchedule([{ month: "2026-10", amount: "300" }, { month: "bad", amount: 1 }]), [{ month: "2026-10", amount: 300 }]);
});

test("amounts in words, as a receipt writes them", () => {
  assert.equal(amountInWords(1500), "One thousand five hundred dirhams only");
  assert.equal(amountInWords(1), "One dirham only");
  assert.equal(amountInWords(250.5), "Two hundred fifty dirhams and fifty fils only");
  assert.equal(amountInWords(21000), "Twenty-one thousand dirhams only");
  assert.equal(amountInWords(1_250_000), "One million two hundred fifty thousand dirhams only");
});

test("an advance's state, and its reference", () => {
  const base = { approvalStatus: "APPROVED", status: "ACTIVE", givenDate: new Date("2026-10-05"), principal: 1000, repaid: 0 };
  assert.equal(advanceState({ ...base, approvalStatus: "PENDING", givenDate: null }).key, "PENDING");
  assert.equal(advanceState({ ...base, givenDate: null }).key, "TO_GIVE");
  assert.equal(advanceState(base).key, "RECOVERING");
  assert.equal(advanceState({ ...base, repaid: 1000, status: "CLEARED" }).key, "CLEARED");
  assert.equal(advanceState({ ...base, approvalStatus: "REJECTED" }).key, "REJECTED");
  assert.equal(advanceRef(7), "ADV-0007");
});

test("setting a month on an advance with no plan yet starts a plan", () => {
  const r = withMonthAmount({ principal: 500, instalment: 500, startMonth: "2026-10", schedule: null, planPending: true }, "2026-07", 500);
  assert.deepEqual(r.schedule, [{ month: "2026-07", amount: 500 }]);
  assert.equal(r.startMonth, "2026-07");
});
test("setting a month on a fixed instalment advance keeps the other months", () => {
  const r = withMonthAmount({ principal: 300, instalment: 100, startMonth: "2026-07", schedule: null, planPending: false }, "2026-08", 50);
  assert.deepEqual(r.schedule, [{ month: "2026-07", amount: 100 }, { month: "2026-08", amount: 50 }, { month: "2026-09", amount: 100 }]);
});
