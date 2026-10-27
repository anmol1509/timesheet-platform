import test from "node:test";
import assert from "node:assert/strict";
import { categoryOf, defaultEmailPrefs, inQuietHours, parseEmailPrefs, planEmail, summaryAction, uaeTime } from "./emailPrefs";

// 2026-10-27 is a Tuesday. UAE time is UTC+4.
const tue10am = new Date("2026-10-27T06:00:00Z");
const tue11pm = new Date("2026-10-27T19:00:00Z"); // 23:00 UAE
const sat10am = new Date("2026-10-31T06:00:00Z");

test("every known kind has a category and unknown kinds are not dropped", () => {
  assert.equal(categoryOf("PAYROLL_SUBMITTED"), "approvals");
  assert.equal(categoryOf("AI_CREDITS"), "ai");
  assert.equal(categoryOf("SECURITY_NEW_SIGNIN"), "security");
  assert.equal(categoryOf("SOMETHING_NEW"), "replies");
});

test("UAE time and weekday", () => {
  assert.deepEqual(uaeTime(tue11pm), { hour: 23, weekday: 2 });
  assert.equal(uaeTime(sat10am).weekday, 6);
});

test("defaults: urgent things instant, reminders in the summary", () => {
  const p = defaultEmailPrefs();
  assert.equal(planEmail(p, "PAYROLL_SUBMITTED", tue10am), "SEND_NOW");
  assert.equal(planEmail(p, "DOCUMENT_REMINDER", tue10am), "QUEUE");
});

test("the old single switch is respected until preferences are saved", () => {
  assert.equal(planEmail(parseEmailPrefs(null, false), "PAYROLL_SUBMITTED", tue10am), "SKIP");
  assert.equal(planEmail(parseEmailPrefs(null, true), "PAYROLL_SUBMITTED", tue10am), "SEND_NOW");
});

test("off, paused and master switch skip everything except security", () => {
  const p = defaultEmailPrefs();
  p.categories.approvals = "OFF";
  assert.equal(planEmail(p, "PAYROLL_SUBMITTED", tue10am), "SKIP");
  const q = defaultEmailPrefs(false);
  assert.equal(planEmail(q, "AI_CREDITS", tue10am), "SKIP");
  assert.equal(planEmail(q, "SECURITY_PASSWORD_CHANGED", tue10am), "SEND_NOW");
  const paused = { ...defaultEmailPrefs(), pausedUntil: "2026-10-30T00:00:00Z" };
  assert.equal(planEmail(paused, "PAYROLL_SUBMITTED", tue10am), "SKIP");
  assert.equal(planEmail(paused, "WEBHOOK_DISABLED", tue10am), "SEND_NOW");
  assert.equal(planEmail(paused, "PAYROLL_SUBMITTED", new Date("2026-11-02T06:00:00Z")), "SEND_NOW");
});

test("quiet hours wrap past midnight and hold instant emails", () => {
  const p = defaultEmailPrefs();
  p.quiet = { enabled: true, from: 20, to: 7 };
  assert.equal(inQuietHours(p.quiet, 23), true);
  assert.equal(inQuietHours(p.quiet, 3), true);
  assert.equal(inQuietHours(p.quiet, 10), false);
  assert.equal(planEmail(p, "PAYROLL_SUBMITTED", tue11pm), "QUEUE");
  assert.equal(planEmail(p, "WEBHOOK_DISABLED", tue11pm), "SEND_NOW");
  assert.equal(planEmail(p, "PAYROLL_SUBMITTED", tue10am), "SEND_NOW");
});

test("weekend hold queues on Saturday and waits at the morning run", () => {
  const p = { ...defaultEmailPrefs(), weekends: "HOLD" as const };
  assert.equal(planEmail(p, "PAYROLL_SUBMITTED", sat10am), "QUEUE");
  assert.equal(summaryAction(p, sat10am), "WAIT");
  assert.equal(summaryAction(p, tue10am), "SEND");
  assert.equal(summaryAction({ ...p, enabled: false }, tue10am), "DROP");
});

test("saved preferences are cleaned up", () => {
  const p = parseEmailPrefs({ enabled: true, categories: { approvals: "bogus", reminders: "OFF", security: "OFF" }, quiet: { enabled: true, from: 99, to: 6 }, weekends: "x", pausedUntil: "nope" });
  assert.equal(p.categories.approvals, "INSTANT");
  assert.equal(p.categories.reminders, "OFF");
  assert.equal(p.categories.security, "INSTANT");
  assert.equal(p.quiet.from, 20);
  assert.equal(p.quiet.to, 6);
  assert.equal(p.weekends, "SEND");
  assert.equal(p.pausedUntil, null);
});
