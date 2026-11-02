import test from "node:test";
import assert from "node:assert/strict";
import { gridHeaders, gridToCells, parseGridRecords } from "./timesheetGrid";

test("headers and cells line up: details, then one column per day", () => {
  const h = gridHeaders(5);
  assert.deepEqual(h, ["ID No", "Employee Name", "Trade", "Cost Rate", "Supplier", "Client", "1", "2", "3", "4", "5"]);
  const cells = gridToCells([{ employeeIdNo: "D1", employeeName: "A", trade: "Mason", rate: "21", supplierName: "S", clientName: "C", days: ["10", "A"] }], 5);
  assert.equal(cells[0].length, h.length);
  assert.deepEqual(cells[0].slice(6), ["10", "A", "", "", ""]);
});

test("an exported file reads back the same", () => {
  const rows = [{ employeeIdNo: "D1", employeeName: "Ali", trade: "Mason", rate: "21", supplierName: "S", clientName: "C", days: ["10", "OFF", "A", "", "8.5"] }];
  const h = gridHeaders(5);
  const rec = Object.fromEntries(h.map((x, i) => [x, gridToCells(rows, 5)[0][i]]));
  const back = parseGridRecords([rec], 5);
  assert.deepEqual(back.rows, rows);
  assert.deepEqual(back.missingColumns, []);
});

test("loose headers, 'Day 3' columns, bad cells dropped, days past the month ignored", () => {
  const r = parseGridRecords([{ "Emp Code": "X1", Name: "Sam", Designation: "Welder", "Day 1": "9", "2": "fri", "3": "junk", "31": "10" }], 30);
  assert.equal(r.rows[0].employeeIdNo, "X1");
  assert.equal(r.rows[0].trade, "Welder");
  assert.deepEqual(r.rows[0].days.slice(0, 3), ["9", "OFF", ""]);
  assert.equal(r.ignoredDays, 1);
});

test("rows with no ID or name are dropped and missing columns are named", () => {
  const r = parseGridRecords([{ Trade: "Mason", "1": "10" }], 30);
  assert.equal(r.rows.length, 0);
  assert.deepEqual(r.missingColumns, ["ID No or Employee Name"]);
});
