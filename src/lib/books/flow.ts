/** What a transaction means in plain words: money in, money out, or neither (a journal). Pure, so it can be tested. */
export type FlowLine = { money: boolean; debit: number; credit: number };
export type Flow = { amount: number; direction: "in" | "out" | null; /** True when cash or bank actually moved. Invoices and bills that are not paid yet are not cash. */ cash: boolean };

const r2 = (n: number) => Math.round(n * 100) / 100;
const OUT = new Set(["CREDIT_NOTE", "BILL", "EXPENSE", "PAYROLL"]);
const IN = new Set(["SALES", "DEBIT_NOTE"]);

/**
 * Money in or out follows the bank and cash accounts when the entry touches them. An entry that does not (an invoice,
 * a bill, payroll that is accrued but not paid) is shown on the side it belongs to, marked as not yet cash.
 */
export function entryFlow(type: string, lines: FlowLine[]): Flow {
  const amount = r2(lines.reduce((s, l) => s + l.debit, 0));
  const cash = r2(lines.filter((l) => l.money).reduce((s, l) => s + l.debit - l.credit, 0));
  if (cash !== 0) return { amount: Math.abs(cash), direction: cash > 0 ? "in" : "out", cash: true };
  if (IN.has(type)) return { amount, direction: "in", cash: false };
  if (OUT.has(type)) return { amount, direction: "out", cash: false };
  return { amount, direction: null, cash: false };
}
