import { test } from "node:test";
import assert from "node:assert/strict";
import { escapeHtml, renderEmail, safeUrl } from "./layout";
import { clientDecisionMail, notificationMail, passwordResetMail, styleForKind, supportRequestMail } from "./templates";

const brand = { name: "Al Noor Manpower" };

test("text from people is escaped, not run as HTML", () => {
  assert.equal(escapeHtml(`<script>alert("x")</script>`), "&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;");
  const m = notificationMail({ kind: "X", title: "<b>Hi</b>", body: "a & b <i>c</i>", name: "Sam", appUrl: "https://app.test", brand });
  assert.ok(!m.html.includes("<b>Hi</b>"));
  assert.ok(m.html.includes("&lt;b&gt;Hi&lt;/b&gt;"));
  assert.ok(m.html.includes("a &amp; b &lt;i&gt;c&lt;/i&gt;"));
});

test("only web addresses become links", () => {
  assert.equal(safeUrl("https://app.test/x?y=1"), "https://app.test/x?y=1");
  assert.equal(safeUrl("javascript:alert(1)"), null);
  assert.equal(safeUrl('https://a.test/"onmouseover="x'), null);
  const r = renderEmail({ heading: "H", paragraphs: ["p"], button: { label: "Go", url: "javascript:alert(1)" }, brand });
  assert.ok(!r.html.includes("javascript:"));
  assert.ok(!r.html.includes(">Go<"));
});

test("a notification opens the screen it is about, with a label for its kind", () => {
  const m = notificationMail({ kind: "PAYROLL_SUBMITTED", title: "Payroll submitted for Own Co 2026-08", body: "Net pay AED 33,326.00", href: "/payroll/abc", name: "Fatima Khan", appUrl: "https://app.test", brand });
  assert.equal(m.subject, "Payroll submitted for Own Co 2026-08");
  assert.ok(m.html.includes("Approval needed"));
  assert.ok(m.html.includes("Review the payroll run"));
  assert.ok(m.html.includes('href="https://app.test/payroll/abc"'));
  assert.ok(m.text.includes("Hi Fatima,"));
  assert.ok(m.text.includes("https://app.test/payroll/abc"));
});

test("a notification with no screen has no button", () => {
  const m = notificationMail({ kind: "X", title: "FYI", name: "Sam", appUrl: "https://app.test", brand });
  assert.ok(!m.html.includes("<a href"));
});

test("an unknown kind still gets a plain email", () => {
  assert.equal(styleForKind("NOT_A_KIND").eyebrow, "Notification");
});

test("AI credits turn red once they are used up", () => {
  assert.equal(styleForKind("AI_CREDITS", "Own Co: AI credits are used up").tone, "danger");
  assert.equal(styleForKind("AI_CREDITS", "Own Co: 80% of this month's AI credits are used").tone, "warning");
});

test("the plain-text copy carries the same content", () => {
  const r = renderEmail({ eyebrow: "Test", heading: "Heading", paragraphs: ["One", "- a\n- b"], facts: [{ label: "L", value: "V" }], button: { label: "Open", url: "https://x.test/a" }, note: "Small", brand });
  for (const s of ["TEST", "Heading", "One", "L: V", "Open: https://x.test/a", "Small"]) assert.ok(r.text.includes(s), s);
  assert.ok(r.html.includes("<li"));
});

test("the password email carries the link, one hour and the ignore line", () => {
  const m = passwordResetMail({ name: "Sam Lee", link: "https://app.test/login/reset?token=t", brand });
  assert.ok(m.html.includes("https://app.test/login/reset?token=t"));
  assert.ok(m.text.includes("expires in 1 hour"));
  assert.ok(m.text.includes("you can ignore this email"));
});

test("a client's approval email is signed by the company", () => {
  const m = clientDecisionMail({ clientName: "Gulf Build", subject: "Demand request #12 approved", body: "Approved: Mason × 4.", brand });
  assert.ok(m.html.includes("Hi Gulf Build team,"));
  assert.ok(m.html.includes("Al Noor Manpower"));
});

test("a support request shows who it is from", () => {
  const m = supportRequestMail({ fromName: "Sam", fromEmail: "sam@x.test", page: "/payroll", subject: "Stuck", message: "Help", brand: { name: "ManpowerSync" } });
  assert.equal(m.subject, "[ManpowerSync support] Stuck");
  assert.ok(m.text.includes("From: Sam <sam@x.test>"));
});
