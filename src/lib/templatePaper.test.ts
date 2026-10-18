import test from "node:test";
import assert from "node:assert/strict";
import { sampleFilledHtml } from "./templatePaper";

test("an employee letter's fields become sample details and its blanks stay visible", () => {
  const out = sampleFilledHtml("<p>For %%EMPLOYEENAME%% — %%ASK:Purpose%%</p>", "EMPLOYEE");
  assert.match(out, /AJAY KUMAR/);
  assert.match(out, /\[Purpose\]/);
  assert.doesNotMatch(out, /%%/);
});

test("a client letter gets a sample worker table where the marker was", () => {
  const out = sampleFilledHtml('<p>Before</p><div data-worker-table="true"></div><p>After %%COMPANYNAME%%</p>', "SITE");
  assert.match(out, /<table>/);
  assert.match(out, /AJAY KUMAR/);
  assert.doesNotMatch(out, /data-worker-table/);
  assert.doesNotMatch(out, /%%/);
});
