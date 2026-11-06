import test from "node:test";
import assert from "node:assert/strict";

import { withoutSummaryTable, isDateAsk, isoToLetterDate, letterDateToIso } from "./letterHtml";

test("blanks that ask for a date are recognised", () => {
  for (const l of ["From date", "To date", "Last working date", "Return-to-work date", "Date of incident", "Effective date"]) assert.equal(isDateAsk(l), true, l);
  for (const l of ["Bank name", "Reason", "Type of leave", "What happened", "Update"]) assert.equal(isDateAsk(l), false, l);
});

test("a calendar date converts to the letter format and back", () => {
  assert.equal(isoToLetterDate("2026-10-31"), "31-10-2026");
  assert.equal(letterDateToIso("31-10-2026"), "2026-10-31");
  assert.equal(isoToLetterDate(""), "");
  assert.equal(letterDateToIso("31 October"), "");
});

test("the details box before the worker list can be dropped, leaving the rest", () => {
  const marker = '<div data-worker-table="1"></div>';
  const html = `<p>We undertake</p><table><tbody><tr><td>Supplied to</td><td>X</td></tr></tbody></table>${marker}<p>After</p>`;
  assert.equal(withoutSummaryTable(html), `<p>We undertake</p>${marker}<p>After</p>`);
  const noList = "<table><tbody><tr><td>a</td></tr></tbody></table>";
  assert.equal(withoutSummaryTable(noList), noList);
});
