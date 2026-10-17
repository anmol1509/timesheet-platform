import { createHash } from "node:crypto";
import { parseAmount } from "./importTb";

/** One statement line, signed from our side: money in is positive, money out is negative. */
export type StatementLine = { date: string; description: string; reference?: string; amount: number; balance?: number };
export type StatementParse = { lines: StatementLine[]; skipped: number; error?: string };

const text = (c: unknown) => (c === null || c === undefined ? "" : c instanceof Date ? c.toISOString() : String(c)).trim();
const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];

/** dd/mm/yyyy, dd-mmm-yyyy, yyyy-mm-dd, a Date, or an Excel serial number → YYYY-MM-DD (day first, as banks here print it). */
export function parseStatementDate(cell: unknown): string | null {
  if (cell instanceof Date) return Number.isNaN(cell.getTime()) ? null : cell.toISOString().slice(0, 10);
  if (typeof cell === "number" && cell > 20000 && cell < 80000) return new Date(Math.round((cell - 25569) * 86400000)).toISOString().slice(0, 10);
  const s = text(cell);
  if (!s) return null;
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return ymd(+m[1], +m[2], +m[3]);
  m = s.match(/^(\d{1,2})[/.\-\s]+(\d{1,2})[/.\-\s]+(\d{2,4})/);
  if (m) return ymd(+m[3] < 100 ? 2000 + +m[3] : +m[3], +m[2], +m[1]);
  m = s.match(/^(\d{1,2})[\s\-/]+([A-Za-z]{3,9})[\s\-/,]+(\d{2,4})/);
  if (m) { const mo = MONTHS.indexOf(m[2].slice(0, 3).toLowerCase()) + 1; return mo ? ymd(+m[3] < 100 ? 2000 + +m[3] : +m[3], mo, +m[1]) : null; }
  return null;
}
function ymd(y: number, mo: number, d: number): string | null {
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  const dt = new Date(Date.UTC(y, mo - 1, d));
  return dt.getUTCMonth() === mo - 1 ? dt.toISOString().slice(0, 10) : null;
}

/**
 * Reads a bank statement export: a Date column, a description, and either Withdrawal/Deposit (or Debit/Credit)
 * columns or one signed Amount. Debit and credit follow the bank's view of the account, so a "debit" is money out.
 */
export function parseBankStatement(grid: unknown[][]): StatementParse {
  let hdr = -1, dateC = -1, descC = -1, refC = -1, outC = -1, inC = -1, amtC = -1, balC = -1;
  for (let i = 0; i < Math.min(grid.length, 30) && hdr < 0; i++) {
    const cells = (grid[i] ?? []).map((c) => text(c).toLowerCase());
    const d = cells.findIndex((c) => /^(txn\.?\s*|transaction\s*|value\s*|posting\s*)?date/.test(c));
    if (d < 0) continue;
    const o = cells.findIndex((c) => /^(withdrawal|withdrawals|debit|debits|paid out|money out|dr)\b/.test(c));
    const n = cells.findIndex((c) => /^(deposit|deposits|credit|credits|paid in|money in|cr)\b/.test(c));
    const a = cells.findIndex((c) => /^(amount|transaction amount)\b/.test(c));
    if ((o >= 0 && n >= 0) || a >= 0) {
      hdr = i; dateC = d; outC = o; inC = n; amtC = a;
      descC = cells.findIndex((c) => /(description|details|narration|particulars|remarks|transaction)/.test(c) && !/date|amount/.test(c));
      refC = cells.findIndex((c) => /(reference|ref\b|cheque|chq|instrument)/.test(c));
      balC = cells.findIndex((c) => /balance/.test(c));
    }
  }
  if (hdr < 0) return { lines: [], skipped: 0, error: "Couldn't find the columns. The statement needs a Date column, a description, and Withdrawal and Deposit columns (or one Amount column)." };
  const lines: StatementLine[] = [];
  let skipped = 0;
  for (let i = hdr + 1; i < grid.length; i++) {
    const row = grid[i] ?? [];
    const date = parseStatementDate(row[dateC]);
    if (!date) { if (row.some((c) => text(c))) skipped++; continue; }
    let amount: number;
    if (amtC >= 0) amount = parseAmount(row[amtC]) ?? NaN;
    else amount = Math.abs(parseAmount(row[inC]) ?? 0) - Math.abs(parseAmount(row[outC]) ?? 0);
    if (!Number.isFinite(amount) || amount === 0) { skipped++; continue; }
    const description = descC >= 0 ? text(row[descC]) : "";
    const bal = balC >= 0 ? parseAmount(row[balC]) : null;
    lines.push({ date, description: description || "(no description)", reference: refC >= 0 ? text(row[refC]) || undefined : undefined, amount: Math.round(amount * 100) / 100, balance: bal ?? undefined });
  }
  return { lines, skipped };
}

/** A stable id for a line, so uploading an overlapping statement twice doesn't duplicate it. Identical lines on one day get a sequence. */
export function lineHashes(lines: StatementLine[]): string[] {
  const seen = new Map<string, number>();
  return lines.map((l) => {
    const base = [l.date, l.amount.toFixed(2), l.description.toLowerCase().replace(/\s+/g, " "), l.reference ?? ""].join("|");
    const n = (seen.get(base) ?? 0) + 1;
    seen.set(base, n);
    return createHash("sha1").update(`${base}|${n}`).digest("hex").slice(0, 24);
  });
}
