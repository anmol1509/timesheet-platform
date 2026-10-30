import test from "node:test";
import assert from "node:assert/strict";
import { hasFlag, problemLabels, type PersonRow } from "./peopleFlags";

const base: PersonRow = {
  id: "p1", name: "Test", nationality: null, phone: null, companies: [{ id: "c1", name: "Co", role: "OWNER", percent: 50 }], companyCount: 1, docs: 2,
  flags: { none: false, expired: 0, expiring: 0, missing: 0, noExpiry: 0, unlinked: false }, nextDays: null,
};
const with_ = (flags: Partial<PersonRow["flags"]>): PersonRow => ({ ...base, flags: { ...base.flags, ...flags } });

test("a person with no problems is in order and matches no problem filter", () => {
  assert.equal(hasFlag(base, "ok"), true);
  for (const f of ["none", "noexpiry", "missing", "expired", "expiring", "unlinked"] as const) assert.equal(hasFlag(base, f), false);
  assert.deepEqual(problemLabels(base), []);
});

test("someone expired and missing a required file matches both filters", () => {
  const p = with_({ expired: 1, missing: 1 });
  assert.equal(hasFlag(p, "expired"), true);
  assert.equal(hasFlag(p, "missing"), true);
  assert.equal(hasFlag(p, "ok"), false);
  assert.deepEqual(problemLabels(p), ["1 expired", "1 required missing"]);
});

test("someone with no files and no company is never in order", () => {
  const p = with_({ none: true, unlinked: true });
  assert.equal(hasFlag(p, "ok"), false);
  assert.equal(hasFlag(p, "none"), true);
  assert.equal(hasFlag(p, "unlinked"), true);
});
