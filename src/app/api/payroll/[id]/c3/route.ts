import { NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { prisma } from "@/lib/db";
import { requireUserWithBranch, subjectOf } from "@/lib/auth";
import { isOutsideBranch } from "@/lib/branch";
import { can } from "@/lib/permissions";
import { logAudit } from "@/lib/audit";
import { monthBounds } from "@/lib/payroll";
import { splitPay } from "@/lib/wps";

const fail = (error: string, status = 400, extra: Record<string, unknown> = {}) => NextResponse.json({ error, ...extra }, { status });

// C3 salary-card file for an approved run, in the bank's upload layout: everyone in the run who has a C3 ID on their
// profile, with what they are to be paid. Workers without a C3 ID are not in it (they are paid through the bank or in cash).
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { user, branchId, isSuperAdmin } = await requireUserWithBranch();
  if (!can(subjectOf(user), "payroll.payroll", "export")) return fail("You don't have permission to export payroll.", 403);
  const { id } = await params;
  const run = await prisma.payrollRun.findUnique({
    where: { id },
    include: { lines: { include: { employee: { select: { name: true, c3Id: true } } } }, company: { select: { name: true } } },
  });
  if (!run || isOutsideBranch(run.branchId, branchId, isSuperAdmin)) return fail("Run not found.", 404);
  if (run.status === "DRAFT") return fail("Approve the run before generating the C3 file.");

  const paid = run.lines.filter((l) => !!l.employee.c3Id?.trim()).sort((a, b) => a.employee.name.localeCompare(b.employee.name));
  if (paid.length === 0) return fail("Nobody in this run has a C3 ID. Add it on the worker's Payroll & WPS tab.");

  // The bank's C3 upload template: one sheet, a header row, then a row explaining each column, then one row per worker.
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Sheet1");
  ws.addRow(["EmpId", "Salary", "VariablePay", "FromDate", "ToDate", "DaysOnLeave", "EndOfService"]);
  ws.addRow(["Employee Id", "Total Salary\n(Fixed + Variable)", "Variable Pay (Optional)", "From Date (dd/mm/yyyy)  (Optional)", "To Date (dd/mm/yyyy)  (Optional)", "Days On Leave  (Optional)", "End Of Service\nBenefits \n(Optional)"]);
  ws.getRow(1).font = { bold: true };
  ws.getRow(2).alignment = { wrapText: true, vertical: "top" };
  const dmy = (d: Date) => `${String(d.getUTCDate()).padStart(2, "0")}/${String(d.getUTCMonth() + 1).padStart(2, "0")}/${d.getUTCFullYear()}`;
  const bounds = monthBounds(run.month)!;
  for (const l of paid) {
    const { variable } = splitPay({ net: Number(l.net), overtimePay: Number(l.overtimePay), adjustment: Number(l.adjustment) });
    const partMonth = !!l.periodStart && !!l.periodEnd && (l.employedDays ?? bounds.days) < bounds.days;
    const leave = l.absentDays + l.unpaidLeaveDays;
    ws.addRow([
      l.employee.c3Id!.trim(),
      Number(l.net),
      variable > 0 ? variable : null,
      partMonth ? dmy(l.periodStart!) : null,
      partMonth ? dmy(l.periodEnd!) : null,
      leave > 0 ? leave : null,
      null,
    ]);
  }
  const total = paid.reduce((s, l) => s + Number(l.net), 0);
  ws.getColumn(2).numFmt = "0.00";
  ws.getColumn(3).numFmt = "0.00";
  [16, 22, 20, 24, 24, 18, 20].forEach((w, i) => { ws.getColumn(i + 1).width = w; });
  ws.getRow(2).height = 48;

  const left = run.lines.length - paid.length;
  await logAudit({ entityType: "PAYROLL_RUN", entityId: run.id, action: "UPDATE", after: { exported: "C3 file", employees: paid.length, total: Math.round(total * 100) / 100 }, userId: user.id, userName: user.name, branchId: run.branchId });
  const buffer = Buffer.from(await wb.xlsx.writeBuffer());
  return new NextResponse(buffer as unknown as BodyInit, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="c3-${run.month}.xlsx"`,
      "Cache-Control": "no-store",
      ...(left > 0 ? { "X-Note": `${left} worker${left === 1 ? "" : "s"} in this run have no C3 ID and are not in the file` } : {}),
    },
  });
}
