import { test } from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_PREFERENCES, htmlAttributes, parsePreferences } from "./preferences";

test("unknown or missing values fall back to the defaults", () => {
  assert.deepEqual(parsePreferences(null), DEFAULT_PREFERENCES);
  assert.deepEqual(parsePreferences({ theme: "neon", accent: 7, density: "tiny", startPage: "https://evil.example" }), DEFAULT_PREFERENCES);
});

test("good values are kept", () => {
  const p = parsePreferences({ theme: "system", accent: "teal", density: "compact", textSize: "large", sidebar: "icons", layout: "topbar", startPage: "/payroll" });
  assert.deepEqual(p, { theme: "system", accent: "teal", density: "compact", textSize: "large", sidebar: "icons", layout: "topbar", startPage: "/payroll" });
});

test("only changed choices become attributes", () => {
  assert.deepEqual(htmlAttributes(DEFAULT_PREFERENCES), { "data-theme": "light" });
  assert.deepEqual(htmlAttributes({ theme: "dark", accent: "pink", density: "compact", textSize: "small" }), { "data-theme": "dark", "data-accent": "pink", "data-density": "compact", "data-text": "small" });
});
