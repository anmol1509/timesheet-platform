import test from "node:test";
import assert from "node:assert/strict";
import { formatIban, normalizeIban, validateIban } from "./iban";

const UAE = "AE070331234567890123456"; // the ISO registry's example UAE IBAN

test("a valid UAE IBAN passes, however it is typed", () => {
  for (const s of [UAE, "ae07 0331 2345 6789 0123 456", " AE07-0331-2345-6789-0123-456 "]) {
    const r = validateIban(s);
    assert.equal(r.valid, true, s);
    assert.equal(r.isUae, true);
    assert.equal(r.normalized, UAE);
  }
});

test("a UAE IBAN is split into bank code and account number", () => {
  const r = validateIban(UAE);
  assert.equal(r.bankCode, "033");
  assert.equal(r.accountNumber, "1234567890123456");
  assert.equal(r.formatted, "AE07 0331 2345 6789 0123 456");
});

test("one wrong digit fails the check digits", () => {
  const r = validateIban("AE070331234567890123457");
  assert.equal(r.valid, false);
  assert.match(r.problems.join(" "), /check digits/);
});

test("swapped digits are caught", () => {
  assert.equal(validateIban("AE070331234567890123546").valid, false);
});

test("wrong length is reported with which way it is off", () => {
  assert.match(validateIban(UAE.slice(0, -1)).problems.join(" "), /23 characters.*22.*missing/);
  assert.match(validateIban(UAE + "1").problems.join(" "), /extra character/);
});

test("a letter O where a digit belongs is called out", () => {
  const r = validateIban("AE07O331234567890123456");
  assert.equal(r.valid, false);
  assert.match(r.problems.join(" "), /O at position 5 may be the digit 0/);
});

test("other countries validate too, but are not flagged as UAE", () => {
  for (const s of ["DE89370400440532013000", "GB82 WEST 1234 5698 7654 32"]) {
    const r = validateIban(s);
    assert.equal(r.valid, true, s);
    assert.equal(r.isUae, false);
    assert.equal(r.bankCode, null);
  }
});

test("empty, junk and punctuation inputs give a reason, not a crash", () => {
  assert.equal(validateIban("").valid, false);
  assert.equal(validateIban("12345").valid, false);
  assert.match(validateIban("AE07#0331234567890123456").problems.join(" "), /characters other than/);
});

test("helpers", () => {
  assert.equal(normalizeIban(" ae07-0331 "), "AE070331");
  assert.equal(formatIban("AE070331234567890123456"), "AE07 0331 2345 6789 0123 456");
});
