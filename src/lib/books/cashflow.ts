import { r2 } from "./postings";

export type CfLine = { money: boolean; debit: number; credit: number; accountType: string; tag: string | null };
export type CfEntry = { type: string; lines: CfLine[] };
export type CfKey = "clients" | "suppliers" | "salaries" | "otherOperating" | "assets" | "capital";
export type CashFlow = { rows: Record<CfKey, number>; operating: number; investing: number; financing: number; net: number };

export const CF_LABEL: Record<CfKey, string> = {
  clients: "Received from clients",
  suppliers: "Paid to suppliers",
  salaries: "Salaries and staff",
  otherOperating: "Other income and expenses",
  assets: "Property and equipment",
  capital: "Owners' capital and loans",
};

/** Which line of the cash-flow statement the other side of a money movement belongs to. */
export function cfKey(others: CfLine[]): CfKey {
  const has = (f: (l: CfLine) => boolean) => others.some(f);
  if (has((l) => l.accountType === "EQUITY" && l.tag !== "OPENING_EQUITY")) return "capital";
  if (has((l) => l.accountType === "ASSET" && !l.tag)) return "assets";
  if (has((l) => l.tag === "RECEIVABLE")) return "clients";
  if (has((l) => l.tag === "PAYABLE")) return "suppliers";
  if (has((l) => l.tag === "ACCRUED_SALARIES" || l.tag === "SALARIES" || l.tag === "STAFF_ADVANCES" || l.tag === "DUE_TO_STAFF")) return "salaries";
  return "otherOperating";
}

/** Direct-method cash flow: every entry that moves a bank or cash account, grouped by what it was for. Transfers between money accounts cancel out. */
export function cashFlow(entries: CfEntry[]): CashFlow {
  const rows: Record<CfKey, number> = { clients: 0, suppliers: 0, salaries: 0, otherOperating: 0, assets: 0, capital: 0 };
  for (const e of entries) {
    const delta = e.lines.filter((l) => l.money).reduce((s, l) => s + l.debit - l.credit, 0);
    if (Math.abs(delta) < 0.005) continue;
    rows[cfKey(e.lines.filter((l) => !l.money))] += delta;
  }
  for (const k of Object.keys(rows) as CfKey[]) rows[k] = r2(rows[k]);
  const operating = r2(rows.clients + rows.suppliers + rows.salaries + rows.otherOperating);
  return { rows, operating, investing: rows.assets, financing: rows.capital, net: r2(operating + rows.assets + rows.capital) };
}
