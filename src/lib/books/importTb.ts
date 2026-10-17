/**
 * Reads a trial balance exported from Tally, Zoho Books, QuickBooks or a hand-made Excel sheet into
 * account / debit / credit rows, and guesses where each one belongs in our chart. Pure, so it can be tested
 * on the shapes those tools produce.
 */
import type { AccountType } from "./chart";

export type TbRow = { name: string; code?: string; debit: number; credit: number };
export type TbParse = { rows: TbRow[]; skipped: string[]; sourceDebit: number | null; sourceCredit: number | null; error?: string };

const r2 = (n: number) => Math.round((n + Math.sign(n) * Number.EPSILON) * 100) / 100;
const text = (c: unknown) => (c === null || c === undefined ? "" : typeof c === "object" && c !== null && "text" in c ? String((c as { text: unknown }).text) : String(c)).trim();

/** "1,234.50", "(1,234.50)", "AED 1,234.50 Dr", "-5" → a signed number where credits are negative. Null if not a number. */
export function parseAmount(cell: unknown): number | null {
  if (typeof cell === "number") return Number.isFinite(cell) ? cell : null;
  let s = text(cell);
  if (!s) return null;
  let sign = 1;
  const m = s.match(/\s*(dr|cr|debit|credit)\.?$/i);
  if (m) { sign = /^c/i.test(m[1]) ? -1 : 1; s = s.slice(0, m.index); }
  if (/^\(.*\)$/.test(s)) { sign *= -1; s = s.slice(1, -1); }
  s = s.replace(/^(aed|usd|inr|د\.إ)\s*/i, "").replace(/,/g, "").replace(/\s/g, "");
  if (!/^[-+]?\d*\.?\d+$/.test(s)) return null;
  return sign * Number(s);
}

const TOTAL = /^(grand\s+)?total\b|^difference\b|^diff\b|^opening difference/i;
const isName = (s: string) => /^(particulars|account(\s*name)?|ledger(\s*name)?|name|account title|description)$/i.test(s);
const isCode = (s: string) => /^(account\s*)?(code|number|no\.?|#)$/i.test(s);

/** Finds the header row (the one holding both a Debit and a Credit column, or a single Balance column) and reads below it. */
export function parseTrialBalance(grid: unknown[][]): TbParse {
  const rows: TbRow[] = [];
  const skipped: string[] = [];
  let hdr = -1, dCol = -1, cCol = -1, bCol = -1;
  for (let i = 0; i < Math.min(grid.length, 25) && hdr < 0; i++) {
    const cells = (grid[i] ?? []).map((c) => text(c).toLowerCase());
    const d = cells.findIndex((c) => /^(debit|dr\.?)(\s|$)/.test(c) || c === "debit amount");
    const c = cells.findIndex((x) => /^(credit|cr\.?)(\s|$)/.test(x) || x === "credit amount");
    if (d >= 0 && c >= 0 && d !== c) { hdr = i; dCol = d; cCol = c; }
    else if (d < 0 && c < 0) {
      const b = cells.findIndex((x) => /(closing\s+)?balance|amount/.test(x));
      if (b >= 0 && cells.some(isName.bind(null))) { hdr = i; bCol = b; }
    }
  }
  if (hdr < 0) return { rows, skipped, sourceDebit: null, sourceCredit: null, error: "Couldn't find Debit and Credit columns. Export the Trial Balance with a Debit and a Credit column." };
  // The name column: the header cell (this row or the one above) that says so, otherwise the first column that isn't an amount.
  let nCol = -1, kCol = -1;
  for (const i of [hdr, hdr - 1]) {
    if (i < 0) continue;
    const cells = (grid[i] ?? []).map(text);
    if (nCol < 0) nCol = cells.findIndex(isName);
    if (kCol < 0) kCol = cells.findIndex(isCode);
  }
  if (nCol < 0) nCol = [...Array(Math.max(...grid.slice(hdr).map((r) => r.length), 1)).keys()].find((k) => k !== dCol && k !== cCol && k !== bCol && k !== kCol) ?? 0;
  let sourceDebit: number | null = null, sourceCredit: number | null = null;
  for (let i = hdr + 1; i < grid.length; i++) {
    const row = grid[i] ?? [];
    const name = text(row[nCol]);
    if (!name) continue;
    let debit = 0, credit = 0, any = false;
    if (bCol >= 0) {
      const v = parseAmount(row[bCol]);
      if (v !== null) { any = true; if (v >= 0) debit = v; else credit = -v; }
    } else {
      const d = parseAmount(row[dCol]), c = parseAmount(row[cCol]);
      if (d !== null || c !== null) any = true;
      debit = Math.abs(d ?? 0); credit = Math.abs(c ?? 0);
      // A signed single figure in the debit column (negative = credit).
      if (d !== null && d < 0) { credit += -d; debit -= -d; debit = Math.max(debit, 0); }
    }
    if (TOTAL.test(name)) {
      if (/total/i.test(name)) { sourceDebit = debit || sourceDebit; sourceCredit = credit || sourceCredit; }
      continue;
    }
    if (!any || (debit === 0 && credit === 0)) { if (any === false) skipped.push(name); continue; }
    const net = r2(debit - credit);
    rows.push({ name, code: kCol >= 0 ? text(row[kCol]) || undefined : undefined, debit: net > 0 ? net : 0, credit: net < 0 ? -net : 0 });
  }
  return { rows, skipped, sourceDebit, sourceCredit };
}

/** A minimal CSV reader (quotes, commas inside quotes, CRLF). */
export function parseCsv(input: string): string[][] {
  const out: string[][] = [];
  let row: string[] = [], cell = "", q = false;
  const s = input.replace(/^﻿/, "");
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (q) { if (ch === '"') { if (s[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += ch; }
    else if (ch === '"') q = true;
    else if (ch === ",") { row.push(cell); cell = ""; }
    else if (ch === "\n" || ch === "\r") { if (ch === "\r" && s[i + 1] === "\n") i++; row.push(cell); out.push(row); row = []; cell = ""; }
    else cell += ch;
  }
  if (cell || row.length) { row.push(cell); out.push(row); }
  return out;
}

const norm = (s: string) => s.toLowerCase().replace(/&/g, " and ").replace(/[^a-z0-9]+/g, " ").replace(/\b(a c|account|ac|the)\b/g, " ").replace(/\s+/g, " ").trim();
const words = (s: string) => new Set(norm(s).split(" ").filter((w) => w.length > 2));

export type ChartAccount = { id: string; code: string; name: string; type: string; tag?: string | null };

/**
 * The accounts the system posts to by itself are found by what they are for, not what they are called: Tally's
 * "Sundry Debtors" is our Accounts receivable. A bank ledger only maps to the main bank account when its name is
 * generic ("Bank A/c"); a named bank ("Emirates NBD") stays its own account.
 */
export function aliasTag(name: string): string | null {
  const n = name.toLowerCase();
  if (/bank charge/.test(n)) return "BANK_CHARGES";
  if (/debtor|receivable/.test(n)) return "RECEIVABLE";
  if (/creditor|payable/.test(n) && !/vat/.test(n)) return "PAYABLE";
  if (/vat|tax/.test(n) && /input|recoverable/.test(n)) return "VAT_INPUT";
  if (/vat|tax/.test(n) && /output|payable/.test(n)) return "VAT_OUTPUT";
  if (/^(petty )?cash( in hand| on hand)?$|^cash( a\/c| account)?$/.test(n.trim())) return "CASH";
  if (/bank/.test(n) && norm(n.replace(/bank|cash|current|savings|main|a\/c|account|ac/g, " ")) === "") return "BANK";
  if (/capital/.test(n)) return "CAPITAL";
  if (/retained|profit (and|&) loss|p&l/.test(n)) return "RETAINED_EARNINGS";
  if (/gratuity|end of service|eosb/.test(n)) return "EOSB";
  if (/staff advance|employee advance|loan to staff|staff loan/.test(n)) return "STAFF_ADVANCES";
  if (/prepaid|prepayment/.test(n)) return "PREPAYMENTS";
  if (/salar|wage/.test(n)) return "SALARIES";
  if (/^(sales|service income|service revenue|revenue|manpower supply)/.test(n)) return "INCOME_SALES";
  return null;
}

/** Best existing account for a source row: same code, same name, or enough words in common. */
export function matchAccount(row: TbRow, chart: ChartAccount[]): ChartAccount | null {
  if (row.code) { const byCode = chart.find((a) => a.code === row.code); if (byCode) return byCode; }
  const n = norm(row.name);
  const exact = chart.find((a) => norm(a.name) === n);
  if (exact) return exact;
  const tag = aliasTag(row.name);
  const byTag = tag ? chart.find((a) => a.tag === tag) : undefined;
  if (byTag) return byTag;
  const w = words(row.name);
  if (w.size === 0) return null;
  let best: ChartAccount | null = null, bestScore = 0;
  for (const a of chart) {
    const aw = words(a.name);
    const common = [...w].filter((x) => aw.has(x)).length;
    const score = common / Math.max(w.size, aw.size);
    if (common > 0 && score > bestScore) { best = a; bestScore = score; }
  }
  return bestScore >= 0.6 ? best : null;
}

/** What kind of account a ledger name probably is, falling back on which side its balance sits. */
export function guessType(row: TbRow): AccountType {
  const n = row.name.toLowerCase();
  if (/(capital|reserve|retained|drawing|owner|partner|share)/.test(n)) return "EQUITY";
  if (/(sales|revenue|income|commission|discount received|interest received)/.test(n) && !/receivable|accrued income/.test(n)) return "INCOME";
  if (/(salar|wage|rent|expense|electric|water|telephone|fuel|insurance exp|repair|maintenance|stationery|travel|visa|medical|accommodation|food|ppe|depreciation|bank charge|audit|legal|professional|advertis|cost of|purchase)/.test(n) && row.debit >= row.credit) return "EXPENSE";
  if (/(payable|creditor|loan|vat output|output vat|accrued|provision|gratuity|advance from|deposit received|due to)/.test(n)) return "LIABILITY";
  if (/(bank|cash|receivable|debtor|vat input|input vat|advance|deposit|prepaid|equipment|furniture|vehicle|computer|inventory|stock|fixed asset|property)/.test(n)) return "ASSET";
  return row.debit >= row.credit ? "ASSET" : "LIABILITY";
}
