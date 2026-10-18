import test from "node:test";
import assert from "node:assert/strict";
import { LETTER_PRESETS, presetHtml } from "./letterPresets";
import { unknownFieldsIn } from "./letterFields";
import { legacyTextToHtml } from "./letterHtml";
import { sanitizeLetterHtml } from "./letterSanitize";
import { presetState } from "./letterPresetHistory";

test("every ready-made template uses only real fields", () => {
  for (const p of LETTER_PRESETS) assert.deepEqual(unknownFieldsIn(presetHtml(p), p.audience), [], p.key);
});

test("every employee letter has a details table, and it survives sanitising", () => {
  for (const p of LETTER_PRESETS.filter((x) => x.audience === "EMPLOYEE")) {
    const html = presetHtml(p);
    assert.match(html, /<table>/, p.key);
    assert.match(sanitizeLetterHtml(html), /<table>/, p.key);
  }
});

test("pipe lines become a table, a row of dashes makes the heading, and a first-column width runs down", () => {
  const html = legacyTextToHtml("Intro\n| Item{70%} | Amount |\n|---|---|\n| Gratuity | 5 |\n| Leave | 6 |\nOutro");
  assert.equal((html.match(/<th/g) ?? []).length, 2);
  assert.equal((html.match(/<td/g) ?? []).length, 4);
  assert.equal((html.match(/width: 70%/g) ?? []).length, 3);
  assert.match(html, /<p>Intro<\/p><table>/);
  assert.match(html, /<\/table><p>Outro<\/p>/);
  const kv = legacyTextToHtml("| **A**{34%} | 1 |\n| **B** | 2 |");
  assert.equal((kv.match(/width: 34%/g) ?? []).length, 2);
});

test("a template at the current wording is original; changed words are edited", () => {
  for (const p of LETTER_PRESETS) {
    assert.equal(presetState(p, presetHtml(p)), "original", p.key);
    assert.equal(presetState(p, presetHtml(p) + "<p>My own line.</p>"), "edited", p.key);
  }
});
