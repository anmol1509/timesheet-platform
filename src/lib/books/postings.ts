import { createHash } from "node:crypto";
import { expenseTagFor } from "./chart";

/**
 * What each business event posts to the ledger. Pure: they take plain records and return balanced postings
 * that name accounts by tag, so the sync, the tests and any later preview all use the same rules.
 */
export type PartyType = "CLIENT" | "SUPPLIER" | "EMPLOYEE";
/** `accountId` names a ledger account directly (it wins over `tag`); `bankId` picks the ledger account of that company bank, falling back to the main bank account. */
export type PostLine = { tag: string; debit?: number; credit?: number; description?: string; partyType?: PartyType; partyId?: string; projectId?: string; accountId?: string; bankId?: string };
export type Posting = { sourceKey: string; date: Date; type: string; narration: string; lines: PostLine[] };

export const r2 = (n: number) => Math.round((n + Math.sign(n) * Number.EPSILON) * 100) / 100;

/** Dates stored as DATE come back as UTC midnight already. */
export const utcDay = (d: Date) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));

/** Last day of "YYYY-MM". */
export function monthEnd(month: string): Date {
  const [y, m] = month.split("-").map(Number);
  return new Date(Date.UTC(y, m, 0));
}

export function totals(lines: { debit?: number; credit?: number }[]) {
  const debit = r2(lines.reduce((s, l) => s + (l.debit ?? 0), 0));
  const credit = r2(lines.reduce((s, l) => s + (l.credit ?? 0), 0));
  return { debit, credit, balanced: debit === credit };
}

/** A fingerprint of what a posting would write, so unchanged ones can be skipped. */
export function hashPosting(p: Posting): string {
  const body = JSON.stringify([p.date.toISOString().slice(0, 10), p.type, p.narration, p.lines.map((l) => [l.tag, l.debit ?? 0, l.credit ?? 0, l.partyType ?? "", l.partyId ?? "", l.projectId ?? "", l.description ?? "", ...(l.accountId ? [l.accountId] : []), ...(l.bankId ? [l.bankId] : [])])]);
  return createHash("sha1").update(body).digest("hex");
}

const moneyTag = (method: string | null | undefined) => (method === "CASH" ? "CASH" : "BANK");

export type InvoiceFacts = { id: string; invoiceNumber: string; clientId: string; clientName: string; status: string; issueDate: Date; paidDate: Date | null; subtotal: number; vatAmount: number; totalAmount: number };

/** An issued invoice, and — once it is marked paid — the money coming in. Draft invoices post nothing. */
export function invoicePostings(i: InvoiceFacts): Posting[] {
  if (i.status === "DRAFT") return [];
  const total = r2(i.totalAmount);
  const vat = r2(i.vatAmount);
  const income = r2(total - vat);
  const party = { partyType: "CLIENT" as const, partyId: i.clientId };
  const out: Posting[] = [
    {
      sourceKey: `invoice:${i.id}`,
      date: utcDay(i.issueDate),
      type: "SALES",
      narration: `${i.clientName} — invoice ${i.invoiceNumber}`,
      lines: [
        { tag: "RECEIVABLE", debit: total, ...party },
        { tag: "INCOME_SALES", credit: income },
        ...(vat !== 0 ? [{ tag: "VAT_OUTPUT", credit: vat }] : []),
      ],
    },
  ];
  if (i.status === "PAID" && i.paidDate) {
    out.push({
      sourceKey: `invoice-paid:${i.id}`,
      date: utcDay(i.paidDate),
      type: "RECEIPT",
      narration: `${i.clientName} — payment for ${i.invoiceNumber}`,
      lines: [{ tag: "BANK", debit: total }, { tag: "RECEIVABLE", credit: total, ...party }],
    });
  }
  return out;
}

export type BillFacts = {
  id: string; billNo: string; supplierId: string; supplierName: string; billDate: Date; amount: number; vatAmount: number; approvalStatus: string;
  payments: { id: string; paidOn: Date; amount: number; method: string | null; reference: string | null }[];
};

/** An approved supplier bill, and each payment against it. A "credit" payment is a credit note that cancels cost. */
export function billPostings(b: BillFacts): Posting[] {
  if (b.approvalStatus !== "APPROVED") return [];
  const amount = r2(b.amount);
  const vat = r2(b.vatAmount);
  const total = r2(amount + vat);
  const party = { partyType: "SUPPLIER" as const, partyId: b.supplierId };
  const out: Posting[] = [
    {
      sourceKey: `bill:${b.id}`,
      date: utcDay(b.billDate),
      type: "BILL",
      narration: `${b.supplierName} — bill ${b.billNo}`,
      lines: [
        { tag: "COST_SUPPLIERS", debit: amount, ...party },
        ...(vat !== 0 ? [{ tag: "VAT_INPUT", debit: vat }] : []),
        { tag: "PAYABLE", credit: total, ...party },
      ],
    },
  ];
  for (const p of b.payments) {
    const a = r2(p.amount);
    if (a <= 0) continue;
    const credit = p.method === "CREDIT";
    out.push({
      sourceKey: `billpay:${p.id}`,
      date: utcDay(p.paidOn),
      type: credit ? "JOURNAL" : "PAYMENT",
      narration: `${b.supplierName} — ${credit ? "credit applied to" : "payment for"} bill ${b.billNo}${p.reference ? ` (${p.reference})` : ""}`,
      lines: [{ tag: "PAYABLE", debit: a, ...party }, { tag: credit ? "COST_SUPPLIERS" : moneyTag(p.method), credit: a, ...(credit ? party : {}) }],
    });
  }
  return out;
}

export type ExpenseFacts = {
  id: string; date: Date; category: string; description: string; amount: number; vatAmount: number; paidTo: string | null; paymentMethod: string | null;
  outOfPocket: boolean; reimbursedAt: Date | null; projectId: string | null; status: string;
};

/** An approved expense. Paid from cash, bank, or — when staff paid it themselves — owed to them until reimbursed. */
export function expensePostings(e: ExpenseFacts): Posting[] {
  if (e.status !== "APPROVED") return [];
  const amount = r2(e.amount);
  const vat = r2(e.vatAmount);
  const total = r2(amount + vat);
  const advance = /advance/i.test(e.category);
  const pay = e.outOfPocket ? "DUE_TO_STAFF" : moneyTag(e.paymentMethod);
  const out: Posting[] = [
    {
      sourceKey: `expense:${e.id}`,
      date: utcDay(e.date),
      type: "EXPENSE",
      narration: `${e.category} — ${e.description}${e.paidTo ? ` (${e.paidTo})` : ""}`,
      lines: [
        { tag: advance ? "STAFF_ADVANCES" : expenseTagFor(e.category), debit: amount, ...(e.projectId ? { projectId: e.projectId } : {}) },
        ...(vat !== 0 ? [{ tag: "VAT_INPUT", debit: vat }] : []),
        { tag: pay, credit: total },
      ],
    },
  ];
  if (e.outOfPocket && e.reimbursedAt) {
    out.push({
      sourceKey: `expense-reimbursed:${e.id}`,
      date: utcDay(e.reimbursedAt),
      type: "PAYMENT",
      narration: `Reimbursed to staff — ${e.description}`,
      lines: [{ tag: "DUE_TO_STAFF", debit: total }, { tag: "BANK", credit: total }],
    });
  }
  return out;
}

export type PayrollFacts = {
  id: string; month: string; status: string; approvedAt: Date | null; paidAt: Date | null; label: string;
  lines: { net: number; loanDeduction: number; paymentStatus: string; projectId: string | null }[];
};

/**
 * An approved payroll run: salary expense for the month (net pay plus loans recovered), owed as accrued salaries
 * until paid, with any loan instalments clearing staff advances. Payment posts when lines are paid.
 */
export function payrollPostings(r: PayrollFacts): Posting[] {
  if (r.status !== "APPROVED" && r.status !== "PAID") return [];
  const net = r2(r.lines.reduce((s, l) => s + l.net, 0));
  const loans = r2(r.lines.reduce((s, l) => s + l.loanDeduction, 0));
  if (net === 0 && loans === 0) return [];
  const byProject = new Map<string, number>();
  for (const l of r.lines) {
    const k = l.projectId ?? "";
    byProject.set(k, r2((byProject.get(k) ?? 0) + l.net + l.loanDeduction));
  }
  const expense: PostLine[] = [...byProject.entries()].filter(([, v]) => v !== 0).map(([k, v]) => ({ tag: "SALARIES", debit: v, ...(k ? { projectId: k } : {}) }));
  const out: Posting[] = [
    {
      sourceKey: `payroll:${r.id}`,
      date: monthEnd(r.month),
      type: "PAYROLL",
      narration: `Payroll ${r.month} — ${r.label}`,
      lines: [...expense, { tag: "ACCRUED_SALARIES", credit: net }, ...(loans !== 0 ? [{ tag: "STAFF_ADVANCES", credit: loans }] : [])],
    },
  ];
  const paid = r.status === "PAID" ? net : r2(r.lines.filter((l) => l.paymentStatus === "PAID").reduce((s, l) => s + l.net, 0));
  if (paid > 0) {
    out.push({
      sourceKey: `payroll-paid:${r.id}`,
      date: utcDay(r.paidAt ?? r.approvedAt ?? monthEnd(r.month)),
      type: "PAYMENT",
      narration: `Salaries paid ${r.month} — ${r.label}`,
      lines: [{ tag: "ACCRUED_SALARIES", debit: paid }, { tag: "BANK", credit: paid }],
    });
  }
  return out;
}

export type LoanFacts = { id: string; refNo: number; employeeId: string; employeeName: string; principal: number; approvalStatus: string; givenDate: Date | null; method: string | null; type: string };

/** A loan or advance handed over to an employee. */
export function loanPostings(l: LoanFacts): Posting[] {
  if (l.approvalStatus !== "APPROVED" || !l.givenDate || l.principal <= 0) return [];
  return [
    {
      sourceKey: `loan:${l.id}`,
      date: utcDay(l.givenDate),
      type: "PAYMENT",
      narration: `${l.type === "LOAN" ? "Loan" : "Advance"} to ${l.employeeName}`,
      lines: [{ tag: "STAFF_ADVANCES", debit: r2(l.principal), partyType: "EMPLOYEE", partyId: l.employeeId }, { tag: moneyTag(l.method), credit: r2(l.principal) }],
    },
  ];
}

/** Money moved from the bank into the petty cash float. */
export function topUpPostings(t: { id: string; amount: number; date: Date; note: string | null }): Posting[] {
  if (t.amount <= 0) return [];
  return [
    {
      sourceKey: `topup:${t.id}`,
      date: utcDay(t.date),
      type: "TRANSFER",
      narration: `Petty cash top-up${t.note ? ` — ${t.note}` : ""}`,
      lines: [{ tag: "CASH", debit: r2(t.amount) }, { tag: "BANK", credit: r2(t.amount) }],
    },
  ];
}

export type SettlementFacts = {
  id: string; employeeId: string; employeeName: string; status: string; paidAt: Date | null;
  gratuity: number; unpaidSalary: number; leavePay: number; noticePay: number; otherEarnings: number; loanBalance: number; otherDeductions: number;
  /** Whether the gratuity / leave pay come out of a provision the books are building. */
  fromGratuityProvision: boolean; fromLeaveProvision: boolean;
};

/**
 * A final settlement paid out: gratuity and leave pay clear their provisions (or are charged straight to cost when
 * none is kept), the rest is salary cost, loans still owed clear staff advances, and the bank pays what is left.
 */
export function settlementPostings(s: SettlementFacts): Posting[] {
  if (s.status !== "PAID" || !s.paidAt) return [];
  const party = { partyType: "EMPLOYEE" as const, partyId: s.employeeId };
  const salary = r2(s.unpaidSalary + s.noticePay + s.otherEarnings);
  const lines: PostLine[] = [
    ...(s.gratuity > 0 ? [{ tag: s.fromGratuityProvision ? "EOSB" : "EXP_EOSB", debit: r2(s.gratuity) }] : []),
    ...(s.leavePay > 0 ? [{ tag: s.fromLeaveProvision ? "PROVISION_LEAVE" : "SALARIES", debit: r2(s.leavePay) }] : []),
    ...(salary > 0 ? [{ tag: "SALARIES", debit: salary }] : []),
    ...(s.loanBalance > 0 ? [{ tag: "STAFF_ADVANCES", credit: r2(s.loanBalance), ...party }] : []),
    ...(s.otherDeductions > 0 ? [{ tag: "INCOME_OTHER", credit: r2(s.otherDeductions) }] : []),
  ];
  if (lines.length === 0) return [];
  const bank = r2(lines.reduce((n, l) => n + (l.debit ?? 0) - (l.credit ?? 0), 0));
  if (bank !== 0) lines.push(bank > 0 ? { tag: "BANK", credit: bank } : { tag: "BANK", debit: -bank });
  return [{ sourceKey: `settlement:${s.id}`, date: utcDay(s.paidAt), type: "PAYMENT", narration: `Final settlement — ${s.employeeName}`, lines }];
}
