import test from "node:test";
import assert from "node:assert/strict";
import { identityMismatch, namesMatch } from "./personName";

test("the same name in a different order matches", () => {
  assert.ok(namesMatch("YADAV RAMESH KUMAR", "Ramesh Yadav"));
});

test("a missing or extra middle name still matches", () => {
  assert.ok(namesMatch("RAMESH KUMAR YADAV", "Ramesh Yadav"));
  assert.ok(namesMatch("Ramesh Yadav", "RAMESH KUMAR YADAV"));
});

test("a one-letter spelling difference in a long name matches", () => {
  assert.ok(namesMatch("MOHAMMAD ALI KHAN", "Muhammad Ali Khan"));
  assert.ok(namesMatch("TARIQ MEHMOOD", "Tariq Mahmood"));
});

test("a different person does not match", () => {
  assert.equal(namesMatch("TARIQ MAHMOOD", "Ramesh Yadav"), false);
  assert.equal(namesMatch("AJAY KUMAR SHARMA", "Ramesh Kumar Yadav"), false);
});

test("one shared common word is not enough when both names have two or more words", () => {
  assert.equal(namesMatch("MOHAMMED KHAN", "Mohammed Ali"), false);
});

test("a one-word name matches on that word", () => {
  assert.ok(namesMatch("RAMESH KUMAR YADAV", "Ramesh"));
});

test("accents and punctuation are ignored", () => {
  assert.ok(namesMatch("José  O'NEIL", "Jose Oneil"));
});

test("an unreadable name is never a mismatch", () => {
  assert.ok(namesMatch("", "Ramesh Yadav"));
  assert.ok(namesMatch(null, "Ramesh Yadav"));
  assert.equal(identityMismatch({ name: "" }, { name: "Ramesh Yadav" }), null);
});

test("same name but a different birth date is flagged", () => {
  const m = identityMismatch({ name: "RAMESH YADAV", dateOfBirth: "1990-01-01" }, { name: "Ramesh Yadav", dateOfBirth: "1985-06-28" });
  assert.equal(m?.kind, "birthdate");
  assert.equal(identityMismatch({ name: "RAMESH YADAV", dateOfBirth: "1985-06-28" }, { name: "Ramesh Yadav", dateOfBirth: "1985-06-28T00:00:00.000Z" }), null);
});

test("a different name is flagged as a name mismatch", () => {
  assert.equal(identityMismatch({ name: "TARIQ MAHMOOD" }, { name: "Ramesh Yadav" })?.kind, "name");
});
