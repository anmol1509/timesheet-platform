import { todayInUae } from "@/lib/today";
import { NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { requireUserWithBranch, subjectOf } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { prisma } from "@/lib/db";
import { BUCKETS, BUCKET_LABEL } from "@/lib/books/ageing";
import { CF_LABEL, type CfKey } from "@/lib/books/cashflow";
import { TYPE_LABEL } from "@/lib/books/chart";
import { netProfit, normalBalance, trialBalance } from "@/lib/books/ledger";
import { EMIRATES } from "@/lib/books/vat";
import { accountsWithTotals } from "../../books-data";
import { loadAgeing, loadCashFlow, loadProjectProfit, loadVat } from "../report-data";

type Cell = string | number | null;
type Sheet = { title: string; columns: string[]; rows: Cell[][]; /** Row indexes to show bold (totals, headings). */ bold?: number[] };

const valid = (s: string | null) => (s && /^\d{4}-\d{2}-\d{2}$/.test(s) ? new Date(`${s}T00:00:00.000Z`) : null);
const num = (s: string | null) => { const x = Number((s ?? "").replace(/,/g, "")); return Number.isFinite(x) && x > 0 ? x : undefined; };

/** The report as a table: the same figures the screen shows, ready to put in a spreadsheet. */
async function build(view: string, branchId: string, from: Date, asOf: Date, q: URLSearchParams): Promise<Sheet | null> {
  const day = (d: Date) => d.toISOString().slice(0, 10);
  if (view === "pnl") {
    const period = await accountsWithTotals(branchId, asOf, from, true);
    const income = period.filter((a) => a.type === "INCOME" && (a.debit || a.credit));
    const expense = period.filter((a) => a.type === "EXPENSE" && (a.debit || a.credit));
    const sum = (xs: typeof income) => xs.reduce((s, a) => s + normalBalance(a), 0);
    const profit = netProfit(period.map((a) => ({ id: a.id, code: a.code, name: a.name, type: a.type, debit: a.debit, credit: a.credit })));
    const rows: Cell[][] = [["Income", null], ...income.map((a): Cell[] => [a.name, normalBalance(a)]), ["Total income", sum(income)], ["Costs", null], ...expense.map((a): Cell[] => [a.name, normalBalance(a)]), ["Total costs", sum(expense)], [profit < 0 ? "Loss" : "Profit", profit]];
    const bold = [0, income.length + 1, income.length + 2, income.length + 2 + expense.length + 1, rows.length - 1];
    return { title: `Profit and loss ${day(from)} to ${day(asOf)}`, columns: ["Account", "AED"], rows, bold };
  }
  if (view === "balance") {
    const all = await accountsWithTotals(branchId, asOf);
    const profitToDate = netProfit(all.map((a) => ({ id: a.id, code: a.code, name: a.name, type: a.type, debit: a.debit, credit: a.credit })));
    const sec = (t: string) => all.filter((a) => a.type === t && (a.debit || a.credit));
    const rows: Cell[][] = [];
    const bold: number[] = [];
    const block = (t: string, extra?: Cell[][]) => {
      bold.push(rows.length); rows.push([TYPE_LABEL[t as keyof typeof TYPE_LABEL], null]);
      for (const a of sec(t)) rows.push([a.name, normalBalance(a)]);
      for (const e of extra ?? []) rows.push(e);
      bold.push(rows.length); rows.push([`Total ${TYPE_LABEL[t as keyof typeof TYPE_LABEL].toLowerCase()}`, sec(t).reduce((s, a) => s + normalBalance(a), 0) + (t === "EQUITY" ? profitToDate : 0)]);
    };
    block("ASSET"); block("LIABILITY"); block("EQUITY", [["Profit to date", profitToDate]]);
    return { title: `Balance sheet as of ${day(asOf)}`, columns: ["Account", "AED"], rows, bold };
  }
  if (view === "trial") {
    const tb = trialBalance(await accountsWithTotals(branchId, asOf));
    return { title: `Trial balance as of ${day(asOf)}`, columns: ["Code", "Account", "Debit", "Credit"], rows: [...tb.rows.map((r): Cell[] => [r.code, r.name, r.debitBalance || null, r.creditBalance || null]), ["", "Total", tb.debit, tb.credit]], bold: [tb.rows.length] };
  }
  if (view === "cash") {
    const { opening, c, close } = await loadCashFlow(branchId, from, asOf);
    const k = (key: CfKey): Cell[] => [CF_LABEL[key], c.rows[key]];
    const rows: Cell[][] = [["Cash at start", opening], ["Day-to-day business", null], k("clients"), k("suppliers"), k("salaries"), k("otherOperating"), ["Cash from operations", c.operating], ["Buying equipment and property", c.investing], ["Owners and lenders", c.financing], ["Net movement", c.net], ["Cash at end", close]];
    return { title: `Cash flow ${day(from)} to ${day(asOf)}`, columns: ["", "AED"], rows, bold: [0, 1, 6, 9, 10] };
  }
  if (view === "ar" || view === "ap") {
    const side = view === "ar" ? "RECEIVABLE" : "PAYABLE";
    const { rows: ag, t, info } = await loadAgeing(branchId, asOf, side);
    const rows: Cell[][] = [...ag.map((r): Cell[] => [r.partyId ? info.get(r.partyId)?.name ?? "Unknown" : "Opening balance", ...BUCKETS.map((b) => r.buckets[b]), r.total]), ["Total", ...BUCKETS.map((b) => t.buckets[b]), t.total]];
    return { title: `${view === "ar" ? "Who owes you" : "Who you owe"} as of ${day(asOf)}`, columns: [view === "ar" ? "Client" : "Supplier", ...BUCKETS.map((b) => BUCKET_LABEL[b]), "Total"], rows, bold: [rows.length - 1] };
  }
  if (view === "project") {
    const { result, cName, pById } = await loadProjectProfit(branchId, from, asOf);
    const rows: Cell[][] = [];
    const bold: number[] = [];
    for (const cl of result.clients) {
      const sal = cl.projects.reduce((s, p) => s + p.salaries, 0), oth = cl.projects.reduce((s, p) => s + p.otherCosts, 0);
      bold.push(rows.length); rows.push([cl.clientId ? cName.get(cl.clientId) ?? "Client" : "Revenue with no client", cl.revenue, sal, oth, cl.revenue - sal - oth]);
      for (const p of cl.projects) rows.push([`   ${pById.get(p.projectId)?.name ?? "Project"}`, null, p.salaries, p.otherCosts, -(p.salaries + p.otherCosts)]);
    }
    rows.push(["Company-wide costs (no project)", null, null, result.companyCosts, -result.companyCosts]);
    bold.push(rows.length); rows.push(["Total", result.revenue, null, result.projectCosts + result.companyCosts, result.profit]);
    return { title: `Profit by project ${day(from)} to ${day(asOf)}`, columns: ["Client / project", "Revenue", "Salaries", "Other costs", "Profit"], rows, bold };
  }
  if (view === "vat") {
    const { r, branch } = await loadVat(branchId, from, asOf, { exempt: num(q.get("ex")), reverseSales: num(q.get("rs")), reverseExpenses: num(q.get("re")), importsAmount: num(q.get("ia")), importsVat: num(q.get("iv")) });
    const rows: Cell[][] = [
      ...r.byEmirate.map((e, i): Cell[] => [`1${"abcdefg"[i]}`, `Standard rated supplies in ${e.emirate}`, e.amount, e.vat]),
      ["3", "Supplies subject to the reverse charge", r.reverseSales.amount, r.reverseSales.vat], ["4", "Zero rated supplies", r.zeroRated, null], ["5", "Exempt supplies", r.exempt, null], ["6", "Goods imported into the UAE", r.imports.amount, r.imports.vat],
      ["8", "Total sales", r.salesTotal.amount, r.salesTotal.vat],
      ["9", "Standard rated expenses", r.expensesStandard.amount, r.expensesStandard.vat], ["10", "Supplies subject to the reverse charge", r.reverseExpenses.amount, r.reverseExpenses.vat], ["11", "Total expenses", r.expensesTotal.amount, r.expensesTotal.vat],
      ["12", "Total due tax for the period", null, r.due], ["13", "Total recoverable tax for the period", null, r.recoverable], ["14", r.net >= 0 ? "Payable tax for the period" : "Refundable tax for the period", null, Math.abs(r.net)],
    ];
    return { title: `VAT return ${branch?.name ?? ""} TRN ${branch?.trn ?? "-"} ${day(from)} to ${day(asOf)}`, columns: ["Box", "Description", "Amount (AED)", "VAT (AED)"], rows, bold: [EMIRATES.length + 4, EMIRATES.length + 7, rows.length - 1] };
  }
  return null;
}

/** GET /finance/books/reports/export?view=pnl&from=…&asof=… — the report as an Excel file. */
export async function GET(req: Request) {
  const { user, branchId } = await requireUserWithBranch();
  if (!can(subjectOf(user), "finance.books", "view")) return NextResponse.json({ error: "You don't have permission to view the books." }, { status: 403 });
  if (!branchId) return NextResponse.json({ error: "Pick a branch first." }, { status: 400 });
  const q = new URL(req.url).searchParams;
  const asOf = valid(q.get("asof")) ?? new Date(todayInUae() + "T00:00:00.000Z");
  const from = valid(q.get("from")) ?? new Date(Date.UTC(asOf.getUTCFullYear(), 0, 1));
  const sheet = await build(q.get("view") ?? "", branchId, from, asOf, q);
  if (!sheet) return NextResponse.json({ error: "That report can't be exported." }, { status: 404 });
  const branch = await prisma.branch.findUnique({ where: { id: branchId }, select: { name: true } });
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet(sheet.title.slice(0, 31).replace(/[\\/*?:[\]]/g, "-"));
  ws.addRow([branch?.name ?? ""]).font = { bold: true, size: 13 };
  ws.addRow([sheet.title]).font = { color: { argb: "FF666666" } };
  ws.addRow([]);
  const head = ws.addRow(sheet.columns);
  head.font = { bold: true };
  head.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFEFEFF5" } };
  sheet.rows.forEach((r, i) => {
    const row = ws.addRow(r);
    if (sheet.bold?.includes(i)) row.font = { bold: true };
  });
  ws.columns.forEach((col, i) => {
    const textual = i === 0 || sheet.columns[i] === "Description" || sheet.columns[i] === "Account" || sheet.columns[i] === "Code";
    col.width = textual ? (sheet.columns[i] === "Code" || sheet.columns[i] === "Box" ? 8 : 42) : 16;
    if (!textual) col.numFmt = "#,##0.00;[Red]-#,##0.00";
  });
  ws.getRow(head.number).alignment = { horizontal: "left" };
  const buf = await wb.xlsx.writeBuffer();
  const file = `${sheet.title.replace(/[^A-Za-z0-9]+/g, "-").replace(/^-|-$/g, "").toLowerCase()}.xlsx`;
  return new NextResponse(new Uint8Array(buf as ArrayBuffer), { headers: { "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "Content-Disposition": `attachment; filename="${file}"`, "Cache-Control": "private, no-store" } });
}
