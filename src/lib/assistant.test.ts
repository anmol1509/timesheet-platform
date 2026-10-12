import test from "node:test";
import assert from "node:assert/strict";
import { findGuides, HELP_GUIDES } from "./helpLibrary";
import { approvalBlockers, missingFromPayrollReasons, type MissingFacts } from "./assistantDiagnose";
import { PAYROLL_RULES, REPLY_SCHEMA, buildSystemPrompt } from "./assistantGuide";

const top = (q: string) => findGuides(q, 1)[0]?.id;

test("common questions find the right guide", () => {
  assert.equal(top("why is my worker not in payroll"), "payroll-missing-worker");
  assert.equal(top("I cannot approve the payroll, it says missing bank details"), "payroll-cannot-approve");
  assert.equal(top("how do I set up payroll for the first time"), "payroll-setup");
  assert.equal(top("how do I deduct for short hours, he worked 5 hours instead of 8"), "payroll-short-hours");
  assert.equal(top("how do I download payslips with letterhead"), "payslips-download");
  assert.equal(top("how do I import the client's excel timesheet"), "import-timesheet");
  assert.equal(top("salary calculation for a 31 day month"), "payroll-pay-explained");
  assert.equal(top("why was gas charge deducted"), "payroll-gas");
  assert.equal(top("how do I create the WPS file for the bank"), "wps-file");
});

test("a question with nothing to match finds nothing, rather than a wrong guide", () => {
  assert.deepEqual(findGuides("what is the weather like"), []);
});

test("every guide has steps, a title and unique id", () => {
  const ids = new Set(HELP_GUIDES.map((g) => g.id));
  assert.equal(ids.size, HELP_GUIDES.length);
  for (const g of HELP_GUIDES) {
    assert.ok(g.title.length > 3 && g.steps.length > 0 && g.keywords.length > 0, g.id);
  }
});

const base: MissingFacts = {
  company: { name: "DEMO Co", isOwnCompany: true, payType: null },
  status: "ACTIVE",
  employedInMonth: true,
  pay: { payStructure: "ITEMISED", basicSalary: 3000, flatMonthlyRate: 0, hourlyRate: 0 },
  hourlyHours: null,
  runExists: true,
  inRun: false,
};

test("missing from payroll: each cause is named with its fix", () => {
  assert.deepEqual(missingFromPayrollReasons({ ...base, inRun: true }), []);
  assert.match(missingFromPayrollReasons({ ...base, company: { ...base.company!, isOwnCompany: false } })[0], /not marked as an own company/);
  assert.match(missingFromPayrollReasons({ ...base, status: "TERMINATED" })[0], /Terminated/);
  assert.match(missingFromPayrollReasons({ ...base, employedInMonth: false })[0], /not joined|had left/);
  assert.match(missingFromPayrollReasons({ ...base, pay: { ...base.pay, payStructure: null, basicSalary: 0 } })[0], /can't be paid yet/);
  assert.match(missingFromPayrollReasons({ ...base, pay: { payStructure: "HOURLY", basicSalary: 0, flatMonthlyRate: 0, hourlyRate: 15 }, hourlyHours: 0 })[0], /no timesheet hours/);
  assert.match(missingFromPayrollReasons({ ...base, runExists: false })[0], /no payroll run/);
});

test("missing from payroll: with nothing wrong on the record it says to recalculate", () => {
  assert.match(missingFromPayrollReasons(base)[0], /Recalculate/);
});

test("approval blockers come in the order to deal with them", () => {
  const r = approvalBlockers({ status: "DRAFT", submitted: false, lineCount: 2, total: 9000, threshold: 5000, bankGaps: [{ name: "Ravi", gaps: ["IBAN / account number"] }] });
  assert.equal(r.length, 3);
  assert.match(r[0], /not been sent for approval/);
  assert.match(r[1], /Ravi/);
  assert.match(r[2], /approval limit/);
  assert.deepEqual(approvalBlockers({ status: "DRAFT", submitted: true, lineCount: 2, total: 100, threshold: null, bankGaps: [] }), []);
  assert.match(approvalBlockers({ status: "APPROVED", submitted: true, lineCount: 1, total: 1, threshold: null, bankGaps: [] })[0], /already approved/);
});

test("the instructions know the current pay rules, the screen, and the help guides", () => {
  assert.match(PAYROLL_RULES, /Short hours/);
  assert.match(PAYROLL_RULES, /28, 30 or 31 days/);
  const prompt = buildSystemPrompt([{ href: "/payroll", label: "Payroll", group: "Finance" }], "auto", { path: "/payroll/abc", label: "Finance › Payroll", error: "Missing bank details for 2 employees" });
  assert.match(prompt, /on this screen right now: \/payroll\/abc/);
  assert.match(prompt, /Missing bank details for 2 employees/);
  assert.match(prompt, /Set up payroll for the first time/);
  assert.ok(REPLY_SCHEMA.required.includes("needsHuman"));
  assert.doesNotMatch(buildSystemPrompt([], "auto", null), /on this screen right now/);
});
