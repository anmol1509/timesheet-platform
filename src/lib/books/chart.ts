/** The chart of accounts a branch starts with, and the vocabulary the books share. */

export const ACCOUNT_TYPES = ["ASSET", "LIABILITY", "EQUITY", "INCOME", "EXPENSE"] as const;
export type AccountType = (typeof ACCOUNT_TYPES)[number];

export const TYPE_LABEL: Record<AccountType, string> = {
  ASSET: "Assets",
  LIABILITY: "Liabilities",
  EQUITY: "Equity",
  INCOME: "Income",
  EXPENSE: "Expenses",
};

/** Debit-normal types grow with debits; the rest grow with credits. */
export const isDebitNormal = (t: string) => t === "ASSET" || t === "EXPENSE";

export type ChartRow = { code: string; name: string; type: AccountType; tag?: string };

/**
 * A starting chart for a UAE manpower-supply company. Rows with a `tag` are the accounts the system posts to
 * on its own (invoices, bills, payroll...); they can be renamed but not removed. Everything else is free to edit.
 */
export const DEFAULT_CHART: ChartRow[] = [
  { code: "1010", name: "Cash in hand", type: "ASSET", tag: "CASH" },
  { code: "1100", name: "Bank — main account", type: "ASSET", tag: "BANK" },
  { code: "1200", name: "Accounts receivable", type: "ASSET", tag: "RECEIVABLE" },
  { code: "1300", name: "VAT input (recoverable)", type: "ASSET", tag: "VAT_INPUT" },
  { code: "1400", name: "Staff advances & loans", type: "ASSET", tag: "STAFF_ADVANCES" },
  { code: "1500", name: "Prepayments (visas, insurance)", type: "ASSET", tag: "PREPAYMENTS" },
  { code: "1700", name: "Property & equipment", type: "ASSET", tag: "FIXED_ASSETS" },
  { code: "1750", name: "Accumulated depreciation", type: "ASSET", tag: "ACC_DEP" },
  { code: "2100", name: "Accounts payable", type: "LIABILITY", tag: "PAYABLE" },
  { code: "2200", name: "VAT output (payable)", type: "LIABILITY", tag: "VAT_OUTPUT" },
  { code: "2300", name: "Accrued salaries", type: "LIABILITY", tag: "ACCRUED_SALARIES" },
  { code: "2400", name: "End-of-service provision", type: "LIABILITY", tag: "EOSB" },
  { code: "2410", name: "Leave provision", type: "LIABILITY", tag: "PROVISION_LEAVE" },
  { code: "2420", name: "Air ticket provision", type: "LIABILITY", tag: "PROVISION_TICKETS" },
  { code: "2500", name: "Due to staff (out-of-pocket)", type: "LIABILITY", tag: "DUE_TO_STAFF" },
  { code: "3100", name: "Share capital", type: "EQUITY", tag: "CAPITAL" },
  { code: "3200", name: "Retained earnings", type: "EQUITY", tag: "RETAINED_EARNINGS" },
  { code: "3900", name: "Opening balance equity", type: "EQUITY", tag: "OPENING_EQUITY" },
  { code: "4100", name: "Manpower supply income", type: "INCOME", tag: "INCOME_SALES" },
  { code: "4900", name: "Other income", type: "INCOME", tag: "INCOME_OTHER" },
  { code: "5100", name: "Salaries & wages", type: "EXPENSE", tag: "SALARIES" },
  { code: "5110", name: "End-of-service cost", type: "EXPENSE", tag: "EXP_EOSB" },
  { code: "5120", name: "Leave cost", type: "EXPENSE", tag: "EXP_LEAVE" },
  { code: "5130", name: "Air ticket cost", type: "EXPENSE", tag: "EXP_TICKETS" },
  { code: "5150", name: "Outsourced labour (supplier bills)", type: "EXPENSE", tag: "COST_SUPPLIERS" },
  { code: "5200", name: "Accommodation", type: "EXPENSE", tag: "EXP_ACCOMMODATION" },
  { code: "5250", name: "Food & catering", type: "EXPENSE", tag: "EXP_FOOD" },
  { code: "5300", name: "Transport & fuel", type: "EXPENSE", tag: "EXP_TRANSPORT" },
  { code: "5400", name: "Visa, labour card, medical & insurance", type: "EXPENSE", tag: "EXP_VISA" },
  { code: "5450", name: "Utilities", type: "EXPENSE", tag: "EXP_UTILITIES" },
  { code: "5500", name: "Office & admin", type: "EXPENSE", tag: "EXP_OFFICE" },
  { code: "5600", name: "PPE & safety", type: "EXPENSE", tag: "EXP_PPE" },
  { code: "5700", name: "Bank charges", type: "EXPENSE", tag: "BANK_CHARGES" },
  { code: "5800", name: "Depreciation", type: "EXPENSE", tag: "EXP_DEPRECIATION" },
  { code: "5950", name: "Exchange (gain) / loss", type: "EXPENSE", tag: "EXP_FX" },
  { code: "5900", name: "Other expenses", type: "EXPENSE", tag: "EXPENSE_OTHER" },
];

/** Which expense account an expense category lands in. Anything unrecognised goes to Other expenses. */
export function expenseTagFor(category: string): string {
  const c = category.toLowerCase();
  if (c.includes("accommodation")) return "EXP_ACCOMMODATION";
  if (c.includes("food") || c.includes("catering")) return "EXP_FOOD";
  if (c.includes("transport") || c.includes("fuel") || c.includes("vehicle")) return "EXP_TRANSPORT";
  if (c.includes("visa") || c.includes("immigration") || c.includes("medical") || c.includes("insurance")) return "EXP_VISA";
  if (c.includes("utilit")) return "EXP_UTILITIES";
  if (c.includes("office") || c.includes("admin")) return "EXP_OFFICE";
  if (c.includes("ppe") || c.includes("safety")) return "EXP_PPE";
  return "EXPENSE_OTHER";
}

export const VOUCHER_PREFIX: Record<string, string> = {
  JOURNAL: "JV",
  CREDIT_NOTE: "CN",
  DEBIT_NOTE: "DN",
  OPENING: "OB",
  SALES: "SI",
  RECEIPT: "RC",
  BILL: "PB",
  PAYMENT: "PV",
  EXPENSE: "EX",
  PAYROLL: "PR",
  TRANSFER: "TR",
  CLOSING: "CL",
};

export const TYPE_NAMES: Record<string, string> = {
  JOURNAL: "Journal",
  OPENING: "Opening",
  SALES: "Sales",
  RECEIPT: "Receipt",
  BILL: "Bill",
  PAYMENT: "Payment",
  EXPENSE: "Expense",
  PAYROLL: "Payroll",
  TRANSFER: "Transfer",
  CLOSING: "Year-end close",
};
