import { test } from "node:test";
import assert from "node:assert/strict";
import { accumulated, assetPostings, bookValue, monthlyCharge, type AssetFacts } from "./assets";
import { totals } from "./postings";

const d = (s: string) => new Date(`${s}T00:00:00.000Z`);
const asset = (over: Partial<AssetFacts> = {}): AssetFacts => ({ id: "a1", name: "Pickup truck", cost: 60000, salvage: 6000, purchaseDate: d("2026-03-10"), lifeMonths: 60, paidFromAccountId: null, disposedOn: null, disposalAmount: null, disposalAccountId: null, ...over });

test("straight line from the purchase month, last month takes the rounding", () => {
  assert.equal(monthlyCharge(asset(), "2026-02"), 0);
  assert.equal(monthlyCharge(asset(), "2026-03"), 900);
  assert.equal(accumulated(asset(), "2026-05"), 2700);
  assert.equal(bookValue(asset(), "2026-05"), 57300);
  const odd = asset({ cost: 1000, salvage: 0, lifeMonths: 3 });
  assert.equal(accumulated(odd, "2026-05"), 1000);
  assert.equal(monthlyCharge(odd, "2026-05"), 333.34);
  assert.equal(monthlyCharge(odd, "2026-06"), 0);
});

test("depreciation journals balance and only cover finished months from opening", () => {
  const posts = assetPostings([asset(), asset({ id: "a2", name: "Generator", cost: 12000, salvage: 0, lifeMonths: 24 })], d("2026-04-01"), "2026-06");
  const dep = posts.filter((p) => p.sourceKey.startsWith("depreciation:"));
  assert.deepEqual(dep.map((p) => p.sourceKey), ["depreciation:2026-04", "depreciation:2026-05", "depreciation:2026-06"]);
  for (const p of dep) assert.ok(totals(p.lines).balanced);
  assert.equal(dep[0].lines[0].debit, 900 + 500);
});

test("a purchase posts when a paying account is chosen", () => {
  const [buy] = assetPostings([asset({ paidFromAccountId: "acc-bank" })], d("2026-01-01"), "2026-02");
  assert.equal(buy.sourceKey, "asset:a1");
  assert.ok(totals(buy.lines).balanced);
  assert.equal(buy.lines[1].accountId, "acc-bank");
});

test("disposal removes cost and depreciation and books the gain or loss, and stops depreciating", () => {
  const sold = asset({ disposedOn: d("2026-07-15"), disposalAmount: 55000 });
  const posts = assetPostings([sold], d("2026-01-01"), "2026-12");
  const disposal = posts.find((p) => p.sourceKey === "asset-disposal:a1")!;
  assert.ok(totals(disposal.lines).balanced);
  // 5 months (Mar–Jul) × 900 = 4,500 depreciated; 55,000 + 4,500 − 60,000 = 500 loss
  assert.equal(disposal.lines.find((l) => l.tag === "EXPENSE_OTHER")?.debit, 500);
  const gainPost = assetPostings([asset({ disposedOn: d("2026-07-15"), disposalAmount: 58000 })], d("2026-01-01"), "2026-07").find((p) => p.sourceKey === "asset-disposal:a1")!;
  assert.equal(gainPost.lines.find((l) => l.tag === "INCOME_OTHER")?.credit, 2500);
  assert.equal(posts.filter((p) => p.sourceKey.startsWith("depreciation:")).length, 5);
  const loss = assetPostings([asset({ disposedOn: d("2026-07-15"), disposalAmount: 40000 })], d("2026-01-01"), "2026-07").find((p) => p.sourceKey === "asset-disposal:a1")!;
  assert.equal(loss.lines.find((l) => l.tag === "EXPENSE_OTHER")?.debit, 15500);
  assert.ok(totals(loss.lines).balanced);
});
