import { NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { prisma } from "@/lib/db";
import { requireUserWithBranch, subjectOf } from "@/lib/auth";
import { isOutsideBranch } from "@/lib/branch";
import { can } from "@/lib/permissions";
import { isCashMode } from "@/lib/payroll";
import { splitPay } from "@/lib/wps";
import { logAudit } from "@/lib/audit";

const fail = (error: string, status = 400) => NextResponse.json({ error }, { status });

const MONTHS = ["JANUARY", "FEBRUARY", "MARCH", "APRIL", "MAY", "JUNE", "JULY", "AUGUST", "SEPTEMBER", "OCTOBER", "NOVEMBER", "DECEMBER"];

// The payroll sheet banks and exchange houses ask for beside the SIF: company and MOL ID, then one row per bank-paid
// worker with work permit, personal number, bank, card or IBAN, days absent and fixed / variable pay.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { user, branchId, isSuperAdmin } = await requireUserWithBranch();
  if (!can(subjectOf(user), "payroll.payroll", "export")) return fail("You don't have permission to export payroll.", 403);
  const { id } = await params;
  const run = await prisma.payrollRun.findUnique({
    where: { id },
    include: {
      lines: { include: { employee: { select: { name: true, laborCardNumber: true } } } },
      branch: { select: { wpsEstablishmentId: true, name: true } },
      company: { select: { name: true, fullName: true, wpsEstablishmentId: true, contactPerson: true, contactPhone: true, contactEmail: true, phone: true } },
    },
  });
  if (!run || isOutsideBranch(run.branchId, branchId, isSuperAdmin)) return fail("Run not found.", 404);
  if (run.status === "DRAFT") return fail("Approve the run before generating the WPS sheet.");

  const lines = run.lines.filter((l) => !isCashMode(l.paymentMode)).sort((a, b) => a.employee.name.localeCompare(b.employee.name));
  if (lines.length === 0) return fail("No bank-paid employees in this run.");

  const [y, m] = run.month.split("-").map(Number);
  const company = run.company?.fullName || run.company?.name || run.branch.name;
  const molId = run.company?.wpsEstablishmentId ?? run.branch.wpsEstablishmentId ?? "";

  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Sheet");
  ws.mergeCells("D1:F1"); ws.mergeCells("D2:F2"); ws.mergeCells("D3:F3");
  ws.getCell("D1").value = `COMPANY NAME:-  ${company}`;
  ws.getCell("D2").value = `MOL ID No:-  ${molId}`;
  ws.getCell("D3").value = `PAYROLL FOR THE MONTH OF ${MONTHS[m - 1]} -  ${y}`;
  ["D1", "D2", "D3"].forEach((c) => { ws.getCell(c).font = { bold: true }; });

  const heads = ["Sl.No", "NAME OF THE EMPLOYEE", "WORK PERMIT NO (8 DIGIT NO)", "PERSONAL NO (14 DIGIT NO)", "BANK NAME", "FAB CARD NO(16 DIGITS) OR IBAN FOR PERSONAL ACCOUNT (23 DIGITS) ", "NO OF DAYS ABSENT", "Employee's Net Salary"];
  heads.forEach((h, i) => { ws.getCell(6, i + 1).value = h; });
  ["A", "B", "C", "D", "E", "F", "G"].forEach((c) => ws.mergeCells(`${c}6:${c}7`));
  ws.mergeCells("H6:J6");
  ws.getCell("H7").value = "Fixed Portion"; ws.getCell("I7").value = "Variable Portion"; ws.getCell("J7").value = "Total Payment";
  for (let r = 6; r <= 7; r++) for (let c = 1; c <= 10; c++) { const cell = ws.getCell(r, c); cell.font = { bold: true }; cell.alignment = { wrapText: true, vertical: "middle", horizontal: "center" }; cell.border = { top: { style: "thin" }, bottom: { style: "thin" }, left: { style: "thin" }, right: { style: "thin" } }; }

  let row = 8;
  for (const [i, l] of lines.entries()) {
    const { fixed, variable } = splitPay({ net: Number(l.net), overtimePay: Number(l.overtimePay), adjustment: Number(l.adjustment) });
    ws.getRow(row).values = [i + 1, l.employee.name, l.employee.laborCardNumber ?? "", l.personCode ?? "", l.bankName ?? "", l.account ?? "", String(l.absentDays + l.unpaidLeaveDays), fixed, variable];
    ws.getCell(row, 10).value = { formula: `SUM(H${row}:I${row})`, result: Math.round((fixed + variable) * 100) / 100 };
    for (let c = 1; c <= 10; c++) ws.getCell(row, c).border = { top: { style: "thin" }, bottom: { style: "thin" }, left: { style: "thin" }, right: { style: "thin" } };
    row++;
  }
  const last = row - 1;
  ws.mergeCells(`A${row}:G${row}`);
  ws.getCell(row, 1).value = "Total in Dirhms";
  for (const [col, letter] of [[8, "H"], [9, "I"], [10, "J"]] as const) ws.getCell(row, col).value = { formula: `SUM(${letter}8:${letter}${last})` };
  ws.getRow(row).font = { bold: true };
  for (const c of [8, 9, 10]) ws.getColumn(c).numFmt = "#,##0.00";
  row += 2;
  const contact = run.company;
  ws.getCell(row++, 2).value = `CONTACT PERSON - ${contact?.contactPerson ?? ""}`.toUpperCase();
  ws.getCell(row++, 2).value = `MOBILE : - ${contact?.contactPhone ?? ""}`;
  ws.getCell(row++, 2).value = `TELEPHONE - ${contact?.phone ?? ""}`;
  ws.getCell(row++, 2).value = `EMAIL - ${contact?.contactEmail ?? ""}`;
  [7, 34, 20, 20, 14, 28, 12, 14, 14, 14].forEach((w, i) => { ws.getColumn(i + 1).width = w; });

  await logAudit({ entityType: "PAYROLL_RUN", entityId: run.id, action: "UPDATE", after: { exported: "WPS payroll sheet", employees: lines.length }, userId: user.id, userName: user.name, branchId: run.branchId });
  const buffer = Buffer.from(await wb.xlsx.writeBuffer());
  return new NextResponse(buffer as unknown as BodyInit, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="wps-payroll-${run.month}.xlsx"`,
      "Cache-Control": "no-store",
    },
  });
}
