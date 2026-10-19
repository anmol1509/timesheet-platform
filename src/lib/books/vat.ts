import { r2 } from "./postings";

export const EMIRATES = ["Abu Dhabi", "Dubai", "Sharjah", "Ajman", "Umm Al Quwain", "Ras Al Khaimah", "Fujairah"] as const;
export type Emirate = (typeof EMIRATES)[number];
export const VAT_RATE = 0.05;

export type VatEntry = { type: string; lines: { tag: string | null; accountType: string; debit: number; credit: number }[] };
export type Manual = { exempt?: number; reverseSales?: number; reverseExpenses?: number; importsAmount?: number; importsVat?: number };
export type Pair = { amount: number; vat: number };

export type VatReturn = {
  emirate: string;
  /** Box 1a–1g: standard-rated supplies by emirate. */
  byEmirate: { emirate: string; amount: number; vat: number }[];
  reverseSales: Pair; // 3
  zeroRated: number; // 4
  exempt: number; // 5
  imports: Pair; // 6
  salesTotal: Pair; // 8
  expensesStandard: Pair; // 9
  reverseExpenses: Pair; // 10
  expensesTotal: Pair; // 11
  due: number; // 12
  recoverable: number; // 13
  net: number; // 14: positive is payable
};

const pair = (amount: number, vat: number): Pair => ({ amount: r2(amount), vat: r2(vat) });

/** Normalises a typed emirate to one the return knows, falling back to Dubai. */
export function emirateOf(text: string | null | undefined): Emirate {
  const t = (text ?? "").toLowerCase().replace(/[^a-z]/g, "");
  return EMIRATES.find((e) => e.toLowerCase().replace(/[^a-z]/g, "") === t) ?? (t.includes("abudhabi") ? "Abu Dhabi" : t.includes("rak") || t.includes("rasalkhaimah") ? "Ras Al Khaimah" : t.includes("uaq") ? "Umm Al Quwain" : "Dubai");
}

/**
 * The VAT return worked out from the ledger. Sales are the sales-income lines: those on entries that also carry output VAT are
 * standard-rated (credit notes come off), the rest are zero-rated. Purchases are the cost lines of entries that carry input VAT.
 * Anything the ledger can't know (exempt supplies, reverse charge, imports) is typed in.
 */
export function vatReturn(entries: VatEntry[], emirate: string, manual: Manual = {}): VatReturn {
  let stdSales = 0, outVat = 0, zero = 0, stdCost = 0, inVat = 0;
  for (const e of entries) {
    if (e.type === "OPENING") continue;
    const vatOut = e.lines.filter((l) => l.tag === "VAT_OUTPUT").reduce((s, l) => s + l.credit - l.debit, 0);
    const vatIn = e.lines.filter((l) => l.tag === "VAT_INPUT").reduce((s, l) => s + l.debit - l.credit, 0);
    const sales = e.lines.filter((l) => l.tag === "INCOME_SALES").reduce((s, l) => s + l.credit - l.debit, 0);
    if (sales !== 0) {
      if (vatOut !== 0) { stdSales += sales; outVat += vatOut; } else zero += sales;
    } else if (vatOut !== 0) outVat += vatOut;
    if (vatIn !== 0) {
      // The value the VAT was charged on: the cost and asset lines of that entry.
      const base = e.lines.filter((l) => l.accountType === "EXPENSE" || (l.accountType === "ASSET" && !l.tag) || l.tag === "FIXED_ASSETS").reduce((s, l) => s + l.debit - l.credit, 0);
      stdCost += base;
      inVat += vatIn;
    }
  }
  const revSalesAmt = r2(manual.reverseSales ?? 0);
  const revExpAmt = r2(manual.reverseExpenses ?? 0);
  const importsAmt = r2(manual.importsAmount ?? 0);
  const importsVat = r2(manual.importsVat ?? 0);
  const reverseSales = pair(revSalesAmt, revSalesAmt * VAT_RATE);
  const reverseExpenses = pair(revExpAmt, revExpAmt * VAT_RATE);
  const exempt = r2(manual.exempt ?? 0);
  const imports = pair(importsAmt, importsVat);
  const home = emirateOf(emirate);
  const byEmirate = EMIRATES.map((e) => ({ emirate: e, amount: e === home ? r2(stdSales) : 0, vat: e === home ? r2(outVat) : 0 }));
  const salesTotal = pair(stdSales + reverseSales.amount + zero + exempt + imports.amount, outVat + reverseSales.vat + imports.vat);
  const expensesStandard = pair(stdCost, inVat);
  const expensesTotal = pair(expensesStandard.amount + reverseExpenses.amount, expensesStandard.vat + reverseExpenses.vat);
  const due = r2(salesTotal.vat);
  const recoverable = r2(expensesTotal.vat);
  return { emirate: home, byEmirate, reverseSales, zeroRated: r2(zero), exempt, imports, salesTotal, expensesStandard, reverseExpenses, expensesTotal, due, recoverable, net: r2(due - recoverable) };
}

/** The quarter (Jan–Mar…) a date falls in, as from/to day strings, and the one before it. */
export function quarterOf(date: Date, back = 0): { from: string; to: string; label: string } {
  const idx = date.getUTCFullYear() * 4 + Math.floor(date.getUTCMonth() / 3) - back;
  const y = Math.floor(idx / 4);
  const q = idx - y * 4;
  const from = new Date(Date.UTC(y, q * 3, 1));
  const to = new Date(Date.UTC(y, q * 3 + 3, 0));
  return { from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10), label: `Q${q + 1} ${y}` };
}
