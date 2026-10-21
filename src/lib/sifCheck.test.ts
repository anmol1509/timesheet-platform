import test from "node:test";
import assert from "node:assert/strict";
import { checkSif } from "./sifCheck";
import { buildSif, type SifLine } from "./wps";

const IBAN = "AE070331234567890123456";
const line = (over: Partial<SifLine> = {}): SifLine => ({ personCode: "12345678901234", routingCode: "123456789", account: IBAN, periodStart: "2026-09-01", periodEnd: "2026-09-30", days: 30, net: 2078.13, overtimePay: 78.13, adjustment: 0, leaveDays: 0, ...over });
const make = (lines: SifLine[]) =>
  buildSif({ establishmentId: "0000123", payerRoutingCode: "987654321", payerIban: IBAN, month: "2026-09", lines, now: new Date(Date.UTC(2026, 9, 1, 8, 5)) });
const codes = (text: string, file?: string) => checkSif(text, file).issues.map((i) => i.code);

const good = make([line(), line({ personCode: "99999999999999", net: 1500.5, overtimePay: 0 })]);
const rows = good.content.trim().split("\r\n");

test("a file our own builder writes passes with no errors", () => {
  const r = checkSif(good.content, good.filename);
  assert.deepEqual(r.issues.filter((i) => i.severity === "error"), []);
  assert.equal(r.ok, true);
  assert.equal(r.summary.employeeRecords, 2);
  assert.equal(r.summary.declaredTotal, 3578.63);
  assert.equal(r.summary.computedTotal, 3578.63);
});

test("LF-only and BOM-prefixed files are read the same", () => {
  assert.equal(checkSif("﻿" + rows.join("\n")).ok, true);
});

test("a control total that is one fils out is an error", () => {
  const bad = [...rows];
  bad[2] = bad[2].replace("3578.63", "3578.64");
  assert.ok(codes(bad.join("\r\n")).includes("total-mismatch"));
});

test("the record count must match the number of employee lines", () => {
  const bad = [...rows];
  bad[2] = bad[2].replace(",2,3578.63", ",3,3578.63");
  assert.ok(codes(bad.join("\r\n")).includes("count-mismatch"));
});

test("an invalid employee IBAN, a duplicate ID and a short ID are reported", () => {
  const bad = [rows[0].replace(IBAN, "AE070331234567890123457"), rows[1].replace("99999999999999", "12345678901234"), rows[2]];
  const c = codes(bad.join("\r\n"));
  assert.ok(c.includes("iban"));
  assert.ok(c.includes("duplicate"));
  assert.ok(codes(rows[0].replace("12345678901234", "1234567890123") + "\r\n" + rows[2]).includes("person-length"));
});

test("stray spaces, bad dates and non-numeric amounts are reported", () => {
  assert.ok(codes([rows[0].replace(",123456789,", ", 123456789 ,"), rows[2]].join("\r\n")).includes("whitespace"));
  assert.ok(codes([rows[0].replace("2026-09-30", "2026-02-30"), rows[2]].join("\r\n")).includes("end-date"));
  assert.ok(codes([rows[0].replace("2000.00", "2k"), rows[2]].join("\r\n")).includes("amount"));
  // A thousands separator is an extra comma, so the line gains a field.
  assert.ok(codes([rows[0].replace("2000.00", "2,000.00"), rows[2]].join("\r\n")).includes("edr-fields"));
});

test("a wrong number of fields is reported rather than crashing", () => {
  const c = codes([rows[0] + ",extra", rows[2]].join("\r\n"));
  assert.ok(c.includes("edr-fields"));
});

test("missing and duplicate control records", () => {
  assert.ok(codes(rows.slice(0, 2).join("\r\n")).includes("no-scr"));
  assert.ok(codes([...rows, rows[2]].join("\r\n")).includes("many-scr"));
});

test("junk lines, an empty file and the wrong currency", () => {
  assert.ok(codes("hello world\r\n" + rows[2]).includes("unknown-record"));
  assert.ok(codes("   \n\n").includes("empty"));
  assert.ok(codes([rows[0], rows[1], rows[2].replace(",AED,", ",USD,")].join("\r\n")).includes("currency"));
});

test("a control record that is not last is a warning, not an error", () => {
  const r = checkSif([rows[2], rows[0], rows[1]].join("\r\n"));
  assert.ok(r.issues.some((i) => i.code === "scr-position" && i.severity === "warning"));
  assert.equal(r.ok, true);
});

test("file name checks apply to uploads only", () => {
  assert.ok(codes(good.content, "salary.csv").includes("extension"));
  assert.ok(codes(good.content, "9999999260101.SIF").includes("filename"));
  assert.ok(!codes(good.content).some((c) => c === "extension" || c === "filename"));
});

test("errors sort before warnings", () => {
  const r = checkSif([rows[0].replace(IBAN, "AE070331234567890123457").replace("12345678901234", "1234567890123"), rows[2]].join("\r\n"));
  const sev = r.issues.map((i) => i.severity);
  assert.deepEqual([...sev].sort((a, b) => (a === "error" ? 0 : 1) - (b === "error" ? 0 : 1)), sev);
});
