import { test } from "node:test";
import assert from "node:assert/strict";
import { fxPostings, rateOn, toAed } from "./fx";
import { monthsBetween } from "./accruals";
import { totals } from "./postings";

const d = (s: string) => new Date(`${s}T00:00:00.000Z`);

test("the latest rate on or before a date applies", () => {
  const rates = [{ date: d("2026-01-31"), rate: 3.67 }, { date: d("2026-03-31"), rate: 3.7 }];
  assert.equal(rateOn(rates, d("2026-02-28")), 3.67);
  assert.equal(rateOn(rates, d("2026-03-31")), 3.7);
  assert.equal(rateOn(rates, d("2026-01-30")), null);
  assert.equal(toAed(1000, 3.6725), 3672.5);
});

test("a USD balance is revalued each month end and the difference goes to exchange gain or loss", () => {
  const acc = { accountId: "usd", currency: "USD", movements: [{ date: d("2026-01-10"), aed: 3672.5, foreign: 1000 }] };
  const rates = { USD: [{ date: d("2026-01-31"), rate: 3.6725 }, { date: d("2026-02-28"), rate: 3.68 }, { date: d("2026-03-31"), rate: 3.65 }] };
  const posts = fxPostings([acc], rates, monthsBetween("2026-01", "2026-03"));
  assert.deepEqual(posts.map((p) => p.sourceKey), ["fx:2026-02", "fx:2026-03"]); // January already agrees
  for (const p of posts) assert.ok(totals(p.lines).balanced);
  assert.deepEqual(posts[0].lines[0], { tag: "BANK", debit: 7.5, accountId: "usd" }); // 3,680 − 3,672.50: a gain
  assert.deepEqual(posts[1].lines[0], { tag: "BANK", credit: 30, accountId: "usd" }); // 3,650 − 3,680: a loss
  assert.deepEqual(posts[1].lines[1], { tag: "EXP_FX", debit: 30 });
});

test("months without a rate yet are skipped, and a cleared balance is cleared in AED too", () => {
  const acc = { accountId: "usd", currency: "USD", movements: [{ date: d("2026-01-10"), aed: 3672.5, foreign: 1000 }, { date: d("2026-02-10"), aed: -3700, foreign: -1000 }] };
  const posts = fxPostings([acc], { USD: [{ date: d("2026-02-28"), rate: 3.7 }] }, monthsBetween("2026-01", "2026-02"));
  assert.equal(posts.length, 1);
  assert.deepEqual(posts[0].lines[0], { tag: "BANK", debit: 27.5, accountId: "usd" }); // 0 − (3,672.50 − 3,700)
  assert.deepEqual(fxPostings([acc], {}, monthsBetween("2026-01", "2026-02")), []);
});
