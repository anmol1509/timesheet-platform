import { NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { prisma } from "@/lib/db";
import { requireUserWithBranch, subjectOf } from "@/lib/auth";
import { isOutsideBranch } from "@/lib/branch";
import { can } from "@/lib/permissions";
import { lineToPayslipLine } from "@/lib/payslipData";
import { buildPayslip } from "@/lib/payslip";
import { round2 } from "@/lib/payroll";

// Payroll register: every employee's earnings, deductions and net pay, plus a deductions list and the cost by project.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { user, branchId, isSuperAdmin } = await requireUserWithBranch();
  if (!can(subjectOf(user), "payroll.payroll", "export")) return NextResponse.json({ error: "You don't have permission to export payroll." }, { status: 403 });
  const { id } = await params;
  const run = await prisma.payrollRun.findUnique({
    where: { id },
    include: { company: { select: { name: true } }, lines: { include: { employee: { select: { name: true, employeeIdNo: true, trade: true, position: true } } }, orderBy: { employee: { name: "asc" } } } },
  });
  if (!run || isOutsideBranch(run.branchId, branchId, isSuperAdmin)) return NextResponse.json({ error: "Run not found." }, { status: 404 });

  const projectIds = [...new Set(run.lines.map((l) => l.projectId).filter((x): x is string => !!x))];
  const projects = projectIds.length ? await prisma.project.findMany({ where: { id: { in: projectIds } }, select: { id: true, code: true, name: true } }) : [];
  const label = new Map(projects.map((p) => [p.id, `${p.code} ${p.name}`]));

  const wb = new ExcelJS.Workbook();
  const head = (ws: ExcelJS.Worksheet) => { ws.getRow(1).font = { bold: true }; ws.views = [{ state: "frozen", ySplit: 1 }]; };
  const money = "#,##0.00;[Red]-#,##0.00";

  const reg = wb.addWorksheet("Register");
  reg.columns = [
    { header: "ID", key: "id", width: 14 }, { header: "Employee", key: "name", width: 28 }, { header: "Trade / role", key: "role", width: 20 }, { header: "Project", key: "project", width: 26 },
    { header: "Total earnings", key: "gross", width: 15 }, { header: "Total deductions", key: "ded", width: 16 }, { header: "Net pay", key: "net", width: 14 }, { header: "Paid by", key: "paid", width: 16 },
  ];
  const dedRows: { id: string; name: string; item: string; amount: number }[] = [];
  const byProject = new Map<string, { people: number; gross: number; net: number }>();
  let tg = 0, td = 0, tn = 0;
  for (const l of run.lines) {
    const s = buildPayslip(lineToPayslipLine(l));
    const proj = l.projectId ? (label.get(l.projectId) ?? "Removed project") : "No project";
    reg.addRow({ id: l.employee.employeeIdNo, name: l.employee.name, role: l.employee.trade ?? l.employee.position ?? "", project: proj, gross: s.gross, ded: s.totalDeductions, net: s.net, paid: /cash/i.test(l.paymentMode ?? "") ? "Cash" : l.bankName ?? "Bank" });
    for (const d of s.deductions) dedRows.push({ id: l.employee.employeeIdNo, name: l.employee.name, item: d.label, amount: d.amount });
    const p = byProject.get(proj) ?? { people: 0, gross: 0, net: 0 };
    p.people += 1; p.gross = round2(p.gross + s.gross); p.net = round2(p.net + s.net); byProject.set(proj, p);
    tg = round2(tg + s.gross); td = round2(td + s.totalDeductions); tn = round2(tn + s.net);
  }
  reg.addRow({ name: "Total", gross: tg, ded: td, net: tn }).font = { bold: true };
  head(reg);
  for (const k of ["gross", "ded", "net"]) reg.getColumn(k).numFmt = money;

  const ded = wb.addWorksheet("Deductions");
  ded.columns = [{ header: "ID", key: "id", width: 14 }, { header: "Employee", key: "name", width: 28 }, { header: "Deduction", key: "item", width: 36 }, { header: "Amount", key: "amount", width: 14 }];
  dedRows.forEach((r) => ded.addRow(r));
  ded.addRow({ item: "Total", amount: round2(dedRows.reduce((s, r) => s + r.amount, 0)) }).font = { bold: true };
  head(ded); ded.getColumn("amount").numFmt = money;

  const proj = wb.addWorksheet("By project");
  proj.columns = [{ header: "Project", key: "p", width: 34 }, { header: "People", key: "n", width: 10 }, { header: "Earnings", key: "g", width: 14 }, { header: "Net pay", key: "net", width: 14 }];
  for (const [p, v] of [...byProject].sort((a, b) => b[1].net - a[1].net)) proj.addRow({ p, n: v.people, g: v.gross, net: v.net });
  head(proj); proj.getColumn("g").numFmt = money; proj.getColumn("net").numFmt = money;

  const buf = await wb.xlsx.writeBuffer();
  return new NextResponse(new Uint8Array(buf as ArrayBuffer), { headers: { "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "Content-Disposition": `attachment; filename="payroll-register-${run.month}${run.company ? `-${run.company.name.replace(/[^\w]+/g, "-")}` : ""}.xlsx"`, "Cache-Control": "private, no-store" } });
}
