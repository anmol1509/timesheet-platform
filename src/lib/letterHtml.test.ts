import test from "node:test";
import assert from "node:assert/strict";

import { isDateAsk, isoToLetterDate, letterDateToIso } from "./letterHtml";

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
