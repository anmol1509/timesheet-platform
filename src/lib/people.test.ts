import { test } from "node:test";
import assert from "node:assert/strict";
import { duplicateGroups, nearPeople, normalizeName, sameName, similarPeople } from "./people";

test("names match regardless of case, titles, punctuation and word order", () => {
  assert.equal(normalizeName("Mr. Khalid  Al-Mansoori"), "khalid al mansoori");
  assert.ok(sameName("Khalid Al Mansoori", "khalid al-mansoori"));
  assert.ok(sameName("Al Mansoori Khalid", "Khalid Al Mansoori"));
  assert.ok(sameName("José Pérez", "Jose Perez"));
  assert.ok(!sameName("Khalid Al Mansoori", "Khalid Al Nuaimi"));
  assert.ok(!sameName("", ""));
});

test("similarPeople and duplicateGroups", () => {
  const ppl = [{ name: "Ali Khan" }, { name: "ali  khan" }, { name: "Sara Noor" }, { name: "Noor Sara" }, { name: "Omar" }];
  assert.equal(similarPeople("ALI KHAN", ppl).length, 2);
  const g = duplicateGroups(ppl);
  assert.equal(g.length, 2);
  assert.ok(g.every((x) => x.length === 2));
});

test("near names: a slipped letter or a missing middle name is suggested, a different person is not", () => {
  const roster = [{ name: "Mohamed Ali Khan" }, { name: "Mohammed Khan" }, { name: "Sara Noor" }, { name: "Ali Raza" }];
  assert.deepEqual(nearPeople("Mohammed Ali Khan", roster).map((p) => p.name), ["Mohamed Ali Khan", "Mohammed Khan"]);
  assert.deepEqual(nearPeople("Sara Noor", roster), []); // the same person is an exact match, not a suggestion
  assert.deepEqual(nearPeople("Khan Mohammed Ali", [{ name: "Mohammed Ali Khan" }]), []); // same words in another order is an exact match
  assert.deepEqual(nearPeople("Omar Farooq", roster), []);
});
