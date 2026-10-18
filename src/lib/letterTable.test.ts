import test from "node:test";
import assert from "node:assert/strict";
import { sanitizeLetterHtml } from "./letterSanitize";
import { htmlToText } from "./letterHtml";

const TABLE = '<table><tbody><tr><th colspan="1" rowspan="1"><p>Project</p></th><th><p>From</p></th></tr><tr><td><p>Jebel Ali</p></td><td><p>Mar 2022</p></td></tr></tbody></table>';

test("tables written in the editor survive sanitising", () => {
  const out = sanitizeLetterHtml(TABLE);
  assert.match(out, /<table>/);
  assert.match(out, /<th colspan="1" rowspan="1">/);
  assert.match(out, /Jebel Ali/);
});

test("scripts and unknown attributes are still stripped inside a table", () => {
  const out = sanitizeLetterHtml('<table><tr><td onclick="x()" colspan="2"><script>alert(1)</script>hi</td></tr></table>');
  assert.doesNotMatch(out, /onclick|script/);
  assert.match(out, /colspan="2"/);
});

test("a table's words are all in its text, for snippets and field checks", () => {
  const text = htmlToText(TABLE);
  for (const w of ["Project", "From", "Jebel Ali", "Mar 2022"]) assert.ok(text.includes(w), w);
});

import { leftoverPlaceholders } from "./letterHtml";

test("blanks still shown as [Label] in edited wording are found", () => {
  const html = "<p>Holder of passport number [Passport number], born in India, joined [Joining date].</p>";
  assert.deepEqual(leftoverPlaceholders(html, ["Passport number", "Joining date", "Nationality"]), ["Passport number", "Joining date"]);
  assert.deepEqual(leftoverPlaceholders("<p>All filled in.</p>", ["Passport number"]), []);
});
