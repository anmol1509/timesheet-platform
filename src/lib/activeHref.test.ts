import assert from "node:assert/strict";
import { test } from "node:test";
import { clearedHref, hrefIsActive } from "./activeHref";

const q = (s: string) => new URLSearchParams(s);

test("a link is active when the page already shows what it sets", () => {
  assert.equal(hrefIsActive("/employees?filter=bench", "/employees", q("filter=bench")), true);
  assert.equal(hrefIsActive("/employees?filter=bench", "/employees", q("filter=on-work")), false);
  assert.equal(hrefIsActive("/employees?trade=mason", "/employees", q("trade=Mason&open=x")), true);
  assert.equal(hrefIsActive("/employees?filter=bench", "/clients", q("filter=bench")), false);
});

test("a link with no filters is active only when none is set", () => {
  assert.equal(hrefIsActive("/employees", "/employees", q("")), true);
  assert.equal(hrefIsActive("/employees", "/employees", q("open=abc&tab=documents")), true);
  assert.equal(hrefIsActive("/employees", "/employees", q("filter=bench")), false);
});

test("clicking the active item takes its filters off and keeps the others", () => {
  assert.equal(clearedHref("/employees?trade=Mason", "/employees", q("trade=Mason&filter=bench")), "/employees?filter=bench");
  assert.equal(clearedHref("/employees?trade=Mason", "/employees", q("trade=Mason")), "/employees");
});
