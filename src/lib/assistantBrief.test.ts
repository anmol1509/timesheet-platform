import test from "node:test";
import assert from "node:assert/strict";
import { buildBrief } from "./assistantBrief";
import { collectSources, carriedNoData, sourceFor } from "./assistantSources";
import { missingFromPayrollFixes, payrollBlockerFixes } from "./assistantDiagnose";

test("brief is empty when nothing needs attention", () => {
  assert.deepEqual(buildBrief({ renewals: { expired: 0, within7: 0, within30: 4 }, overdue: { count: 0, total: 0 }, absentToday: 0, noPhoto: 0 }), []);
});

test("brief puts expired documents first and mentions what is about to expire", () => {
  const items = buildBrief({ absentToday: 3, overdue: { count: 2, total: 5000 }, renewals: { expired: 1, within7: 2, within30: 5 } });
  assert.deepEqual(items.map((i) => i.id), ["renewals-expired", "invoices-overdue", "absent"]);
  assert.equal(items[0].title, "1 document has expired");
  assert.equal(items[0].detail, "2 more expire within a week.");
});

test("brief flags workers with no profile photo", () => {
  const [item] = buildBrief({ noPhoto: 4 });
  assert.equal(item.title, "4 workers have no profile photo");
  assert.equal(item.action.href, "/employees");
});

test("brief names a blocked payroll run and links it", () => {
  const [item] = buildBrief({ payrollRuns: [{ id: "r1", name: "Acme 2026-09", blockers: ["It has not been sent for approval. Open the run."] }] });
  assert.equal(item.action.href, "/payroll/r1");
  assert.equal(item.detail, "It has not been sent for approval.");
});

test("brief skips runs with nothing in the way and caps the list", () => {
  assert.deepEqual(buildBrief({ payrollRuns: [{ id: "r1", name: "A", blockers: [] }] }), []);
  assert.equal(buildBrief({ renewals: { expired: 1, within7: 0, within30: 1 }, overdue: { count: 1, total: 1 }, notInvoiced: { total: 9, groups: 1 }, absentToday: 1 }, 2).length, 2);
});

test("sources name what a lookup read", () => {
  assert.equal(sourceFor("search_records", { kind: "employee" }), "Employees");
  assert.equal(sourceFor("get_stats", { metric: "invoices", month: "2026-09" }), "Invoices 2026-09");
  assert.equal(sourceFor("explain_payroll_blockers", {}), "Payroll");
  assert.equal(sourceFor("nope", {}), null);
});

test("a lookup that found nothing is not a source", () => {
  assert.equal(carriedNoData("No worker matches that name or ID in this branch."), true);
  assert.equal(carriedNoData("The user doesn't have access to payroll. Say so"), true);
  assert.equal(carriedNoData('{"count":2}'), false);
});

test("sources are listed once, in order", () => {
  assert.deepEqual(collectSources(["Payroll", null, "Employees", "Payroll"]), ["Payroll", "Employees"]);
});

const base = { company: { name: "Acme", isOwnCompany: true, payType: "BASIC" as const }, status: "ACTIVE", employedInMonth: true, pay: { payStructure: null, basicSalary: 0, flatMonthlyRate: 0, hourlyRate: 0 }, hourlyHours: null, runExists: true, inRun: false };
const ids = { employeeId: "e1", employeeName: "Ali Khan", supplierId: "s1", runId: "r1" };

test("a missing pay rate goes to the Trade & pay tab", () => {
  assert.deepEqual(missingFromPayrollFixes(base, ids)[0], { label: "Set Ali's pay", href: "/employees/e1?tab=trade" });
});

test("no fix when the worker is already in the run", () => {
  assert.deepEqual(missingFromPayrollFixes({ ...base, inRun: true }, ids), []);
});

test("a company that is not an own company goes to its page", () => {
  assert.equal(missingFromPayrollFixes({ ...base, company: { name: "Acme", isOwnCompany: false, payType: null } }, ids)[0].href, "/suppliers/s1");
});

test("missing bank details are not a blocker, so they get no fix button", () => {
  const f = { status: "DRAFT", submitted: true, lineCount: 2, total: 1, threshold: null, bankGaps: [{ name: "Sam Lee", gaps: ["IBAN / account number"] }] };
  assert.deepEqual(payrollBlockerFixes(f, { id: "r1", label: "Payroll 2026-09" }, [{ employeeId: "e9", name: "Sam Lee" }]), []);
});

test("a run never sent gets a Submit button", () => {
  const f = { status: "DRAFT", submitted: false, lineCount: 2, total: 1, threshold: null, bankGaps: [] };
  assert.deepEqual(payrollBlockerFixes(f, { id: "r1", label: "x" }, [])[0], { label: "Submit for approval", href: "/payroll/r1" });
});
