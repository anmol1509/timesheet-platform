import { test } from "node:test";
import assert from "node:assert/strict";
import { creditsValueAed, invoiceAmounts, isOwnerUser, isValidCustomerCode, monthlyEquivalent, nextInvoiceNumber, outstanding, receivable } from "./owner";
import { customerSecret, OWNER_API_WINDOW_MS, signRequest, verifyRequest } from "./ownerApi";

test("2,500 credits are worth AED 25 at the standard rate", () => {
  assert.equal(creditsValueAed(2500, 0.01), 25);
  assert.equal(creditsValueAed(5000, 0.01), 50);
  assert.equal(creditsValueAed(0, 0.01), 0);
});

test("a yearly plan counts as a twelfth a month", () => {
  assert.equal(monthlyEquivalent(1200, "YEARLY"), 100);
  assert.equal(monthlyEquivalent(300, "MONTHLY"), 300);
});

test("VAT is 5% and the total adds up", () => {
  assert.deepEqual(invoiceAmounts(1000), { subtotal: 1000, vat: 50, total: 1050 });
  assert.deepEqual(invoiceAmounts(99.99), { subtotal: 99.99, vat: 5, total: 104.99 });
});

test("invoice numbers count up per customer and are never reused", () => {
  assert.equal(nextInvoiceNumber("RKG", []), "INV-RKG-0001");
  assert.equal(nextInvoiceNumber("RKG", ["INV-RKG-0001", "INV-RKG-0002", "INV-BAG-0009"]), "INV-RKG-0003");
  assert.equal(nextInvoiceNumber("rkg", ["INV-RKG-0007"]), "INV-RKG-0008");
});

test("what is owed is the total less payments, never below nothing", () => {
  assert.equal(outstanding(1050, 500), 550);
  assert.equal(outstanding(1050, 1200), 0);
});

test("only sent invoices are receivable, and late ones are flagged", () => {
  const day = 86_400_000;
  const r = receivable([
    { status: "SENT", total: 1000, paid: 400, dueDate: new Date(Date.now() - day) },
    { status: "SENT", total: 500, paid: 0, dueDate: new Date(Date.now() + day) },
    { status: "PAID", total: 800, paid: 800, dueDate: new Date(Date.now() - day) },
    { status: "VOID", total: 900, paid: 0, dueDate: new Date(Date.now() - day) },
    { status: "DRAFT", total: 700, paid: 0, dueDate: new Date(Date.now() - day) },
  ]);
  assert.deepEqual(r, { owed: 1100, overdue: 600 });
});

test("only the owner's super admin account is the owner", () => {
  assert.equal(isOwnerUser({ role: "SUPER_ADMIN", email: "Sales@ManpowerSync.com" }), true);
  assert.equal(isOwnerUser({ role: "BRANCH_ADMIN", email: "sales@manpowersync.com" }), false);
  assert.equal(isOwnerUser({ role: "SUPER_ADMIN", email: "someone@else.com" }), false);
});

test("customer codes are short capitals and numbers", () => {
  assert.equal(isValidCustomerCode("RKG"), true);
  assert.equal(isValidCustomerCode("rkg"), false);
  assert.equal(isValidCustomerCode("R"), false);
  assert.equal(isValidCustomerCode("RKG-1"), false);
});

test("each customer gets its own secret", () => {
  assert.notEqual(customerSecret("master", "RKG"), customerSecret("master", "BAG"));
  assert.equal(customerSecret("master", "rkg"), customerSecret("master", "RKG"));
  assert.notEqual(customerSecret("master", "RKG"), customerSecret("other", "RKG"));
});

test("a signed request verifies, and nothing else does", () => {
  const secret = customerSecret("master", "RKG");
  const now = 1_800_000_000_000;
  const body = JSON.stringify({ grant: 500 });
  const sig = signRequest(secret, now, "POST", "/api/owner/credits", body);
  const ok = { timestamp: String(now), signature: sig, method: "POST", path: "/api/owner/credits", body, now };
  assert.equal(verifyRequest(secret, ok), true);
  assert.equal(verifyRequest(secret, { ...ok, body: JSON.stringify({ grant: 5000 }) }), false, "changed body");
  assert.equal(verifyRequest(secret, { ...ok, path: "/api/owner/suspend" }), false, "other route");
  assert.equal(verifyRequest(customerSecret("master", "BAG"), ok), false, "other customer's secret");
  assert.equal(verifyRequest(secret, { ...ok, now: now + OWNER_API_WINDOW_MS + 1 }), false, "too old");
  assert.equal(verifyRequest(secret, { ...ok, signature: "zz" }), false, "garbage");
  assert.equal(verifyRequest(secret, { ...ok, signature: null }), false, "missing");
});
