import test from "node:test";
import assert from "node:assert/strict";
import ExcelJS from "exceljs";
import { parseConsolidatedWorkbook } from "./parseTimesheet";
import { cellToAttendance } from "./importer/attendance";
import { canonicalMarker, cellsDiffer } from "./timesheetCells";

/** A client's monthly sheet: days 1..31 before TOTAL HOURS, a merged heading row, sign-off lines and summaries below. */
async function clientSheet(): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("JULY-26");
  const days = Array.from({ length: 31 }, (_, i) => i + 1);
  const tail = ["TOTAL HOURS", "ABSENT FINE", "ABSENT DAY", "SALE RATE", "SALARY RATE"];
  ws.addRow(["ALL EMPLOYEE"]);
  ws.addRow(["S.N", "NAME", "COMPANY CODE", "TRADE", "COMPANY", "OS ID", "WORKING COMPANY", "BASIC / HOURLY", ...days, ...tail]);
  const weekdays = ["WED", "THU", "FRI", "SAT", "SUN", "MON", "TUE"]; // 1 July 2026 is a Wednesday
  ws.addRow([null, null, null, null, null, null, null, null, ...days.map((d) => weekdays[(d - 1) % 7]), null, null, null, "PER HR.", "PER HR."]);
  for (const col of [1, 2, 3, 4, 5, 6, 7, 8]) ws.mergeCells(2, col, 3, col); // the heading spans both rows
  const worker = (n: number, name: string, id: string, cells: (string | number | null)[]) =>
    ws.addRow([n, name, null, "CARPENTER", "RKG", id, "MCC", "HOURLY", ...cells, 0, null, null, 9.5, 5.2]);
  const full = days.map(() => 10);
  worker(1, "MUKTI NARAYAN", "OS28927", full.map((v, i) => (i === 4 ? "W" : i === 14 ? "A" : v)));
  worker(2, "JEAN BAPTIST", "M", full.map((v, i) => (i < 10 ? null : v))); // a stub id, and not deployed for the first ten days
  worker(3, "ZERIHUN GICH", "MA", full.map((v, i) => (i === 2 ? "HL" : i === 3 ? "ND" : v)));
  worker(4, "NEVER DEPLOYED", "", days.map(() => null));
  ws.addRow([null, "Prepared By"]);
  ws.addRow([null, null, null, "SALIK", null, 6541.5, null, "SALIK"]); // a billing summary below the sign-off
  ws.addRow([null, "CHANDRABHAN GUPTA"]); // an office-staff list below it
  const draft = wb.addWorksheet("JULY-26 (2)");
  draft.addRow([1, "ZUBAIR VAKEEL", null, "QASR AL"]);
  return Buffer.from(await wb.xlsx.writeBuffer());
}

test("a client sheet with days before the total, NAME and COMPANY headings is read", async () => {
  const r = await parseConsolidatedWorkbook(await clientSheet());
  assert.deepEqual(r.unrecognizedSheets, ["JULY-26 (2)"]);
  assert.equal(r.months.length, 1);
  const m = r.months[0];
  assert.equal(m.month, "2026-07");
  assert.equal(m.entries.length, 4); // the repeated heading, the sign-off and everything below it are not workers
  assert.equal(m.skippedRows, 0);
  assert.equal(m.blankMeansNotDeployed, true);
  const first = m.entries[0];
  assert.equal(first.employeeName, "MUKTI NARAYAN");
  assert.equal(first.employeeIdNo, "OS28927");
  assert.equal(first.supplierName, "RKG");
  assert.equal(first.clientName, "MCC");
  assert.equal(first.rate, 9.5);
  assert.equal(first.payRate, 5.2);
  assert.equal(first.dailyHours.length, 31);
  assert.equal(first.dailyHours[0].date, "2026-07-01");
  assert.equal(first.dailyHours[0].label, "Wed");
  assert.equal(first.dailyHours[4].value, "W");
  assert.equal(first.absentCount, 1);
  assert.equal(first.totalHours, 29 * 10); // 31 days less the W (weekly off) and the A (absent)
});

test("a stub ID is not used as an identifier, and the placeholder is stable", async () => {
  const m = (await parseConsolidatedWorkbook(await clientSheet())).months[0];
  const ids = m.entries.map((e) => e.employeeIdNo);
  assert.deepEqual(ids, ["OS28927", "NOID-JEAN-BAPTIST", "NOID-ZERIHUN-GICH", "NOID-NEVER-DEPLOYED"]);
  assert.equal(new Set(ids).size, ids.length);
});

test("client markers mean what the client says they mean", () => {
  assert.deepEqual(cellToAttendance("W"), { status: "OFF", normalHours: null });
  assert.deepEqual(cellToAttendance("w"), { status: "OFF", normalHours: null });
  assert.deepEqual(cellToAttendance("HL"), { status: "LEAVE", normalHours: null }); // half-day leave
  assert.deepEqual(cellToAttendance("ND"), { status: "IDLE", normalHours: null }); // not deployed
  assert.deepEqual(cellToAttendance("SL"), { status: "SICK_LEAVE", normalHours: null });
  assert.deepEqual(cellToAttendance("H"), { status: "HOLIDAY", normalHours: null });
  assert.equal(canonicalMarker("HL"), "L");
  assert.equal(canonicalMarker("nd"), "I");
});

test("an idle day agrees with a blank cell on the client's sheet, but not with hours", () => {
  assert.equal(cellsDiffer("I", ""), false);
  assert.equal(cellsDiffer("I", null), false);
});

test("the client's spellings of a marker compare equal, and hours differ from an idle day", () => {
  assert.equal(cellsDiffer("OFF", "W"), false);
  assert.equal(cellsDiffer("L", "HL"), false);
  assert.equal(cellsDiffer("I", "ND"), false);
  assert.equal(cellsDiffer("I", "8"), true);
});
