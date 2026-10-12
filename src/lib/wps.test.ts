import test from "node:test";
import assert from "node:assert/strict";
import { buildSif, splitPay, type SifLine } from "./wps";

const line = (over: Partial<SifLine> = {}): SifLine => ({ personCode: "12345678901234", routingCode: "123456789", account: "AE070331234567890123456", periodStart: "2026-09-01", periodEnd: "2026-09-30", days: 30, net: 2078.13, overtimePay: 78.13, adjustment: 0, leaveDays: 0, ...over });

test("fixed plus variable always equals net pay", () => {
  for (const l of [line(), line({ adjustment: 150.5, net: 2228.63 }), line({ adjustment: -40, net: 2038.13 }), line({ overtimePay: 0, net: 1990 })]) {
    const { fixed, variable } = splitPay(l);
    assert.equal(Math.round((fixed + variable) * 100), Math.round(l.net * 100));
  }
});

test("a negative adjustment is not variable pay", () => {
  assert.equal(splitPay(line({ adjustment: -40, overtimePay: 0, net: 1960 })).variable, 0);
});

test("the control record carries the count and a total that ties to the lines", () => {
  const lines = [line(), line({ personCode: "99999999999999", net: 1500, overtimePay: 0 })];
  const sif = buildSif({ establishmentId: "0000123", payerRoutingCode: "987654321", payerIban: "AE000000000000000000001", month: "2026-09", lines, now: new Date(Date.UTC(2026, 9, 1, 8, 5)) });
  const rows = sif.content.trim().split("\r\n");
  assert.equal(rows.length, 3);
  assert.ok(rows[0].startsWith("EDR,12345678901234,123456789,"));
  const scr = rows[2].split(",");
  assert.equal(scr[0], "SCR");
  assert.equal(scr[1], "0000123");
  assert.equal(scr[5], "092026");
  assert.equal(scr[6], "2");
  assert.equal(scr[7], "3578.13");
  assert.equal(sif.total, 3578.13);
  assert.equal(sif.count, 2);
  const edrTotal = rows.slice(0, 2).reduce((s, r) => { const c = r.split(","); return s + Number(c[7]) + Number(c[8]); }, 0);
  assert.equal(Math.round(edrTotal * 100), 357813);
  assert.match(sif.filename, /^0000123261001\d{4}\.SIF$/);
});
