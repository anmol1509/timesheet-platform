/** Rules for the owner's dashboard: who the owner is, and the money and credit arithmetic. Pure, so it can be tested. */

export const OWNER_EMAILS = (process.env.OWNER_EMAILS ?? "sales@manpowersync.com").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);

/** The owner is a super admin whose email is on the owner list. Only the owner's own deployment shows the dashboard at all. */
export function isOwnerUser(user: { role: string; email: string }): boolean {
  return user.role === "SUPER_ADMIN" && OWNER_EMAILS.includes(user.email.toLowerCase());
}

/** What a customer's AI credits are worth in AED at the owner's rate. Customers are only ever shown credits, never this. */
export function creditsValueAed(credits: number, rateAed: number): number {
  return Math.round(credits * rateAed * 100) / 100;
}

/** The monthly money a customer brings in: a yearly plan counts as a twelfth each month. */
export function monthlyEquivalent(price: number, cycle: string): number {
  return Math.round((cycle === "YEARLY" ? price / 12 : price) * 100) / 100;
}

export const UAE_VAT_RATE = 0.05;

export function invoiceAmounts(subtotal: number, vatRate: number = UAE_VAT_RATE): { subtotal: number; vat: number; total: number } {
  const s = Math.round(subtotal * 100) / 100;
  const vat = Math.round(s * vatRate * 100) / 100;
  return { subtotal: s, vat, total: Math.round((s + vat) * 100) / 100 };
}

/** The next invoice number for a customer: INV-RKG-0001, then 0002. Numbers already used are never repeated. */
export function nextInvoiceNumber(code: string, existing: string[]): string {
  const prefix = `INV-${code.toUpperCase()}-`;
  const used = existing.filter((n) => n.startsWith(prefix)).map((n) => Number(n.slice(prefix.length))).filter((n) => Number.isInteger(n));
  return `${prefix}${String((used.length ? Math.max(...used) : 0) + 1).padStart(4, "0")}`;
}

/** What is still owed on an invoice after the payments against it. */
export function outstanding(total: number, paid: number): number {
  return Math.max(0, Math.round((total - paid) * 100) / 100);
}

export type InvoiceLike = { status: string; total: number; dueDate: Date };

/** The money not yet received on invoices that count: sent, not void or draft. */
export function receivable(invoices: (InvoiceLike & { paid: number })[]): { owed: number; overdue: number } {
  const now = Date.now();
  let owed = 0, overdue = 0;
  for (const i of invoices) {
    if (i.status !== "SENT") continue;
    const left = outstanding(i.total, i.paid);
    owed += left;
    if (left > 0 && i.dueDate.getTime() < now) overdue += left;
  }
  return { owed: Math.round(owed * 100) / 100, overdue: Math.round(overdue * 100) / 100 };
}

export const CUSTOMER_STATUSES = ["TRIAL", "ACTIVE", "SUSPENDED", "CHURNED"] as const;
export const CUSTOMER_STATUS_LABEL: Record<string, string> = { TRIAL: "Trial", ACTIVE: "Active", SUSPENDED: "Suspended", CHURNED: "Left" };
/** Customers that count toward the monthly recurring money. */
export const PAYING_STATUSES = new Set(["ACTIVE"]);

/** A customer code: capitals and numbers, 2 to 10 characters, used in invoice numbers and the deployment's secret. */
export const isValidCustomerCode = (code: string) => /^[A-Z0-9]{2,10}$/.test(code);
