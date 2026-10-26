import { NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { prisma } from "@/lib/db";
import { requireUserWithBranch, subjectOf } from "@/lib/auth";
import { isOutsideBranch } from "@/lib/branch";
import { can } from "@/lib/permissions";
import { logAudit } from "@/lib/audit";

const fail = (error: string, status = 400, extra: Record<string, unknown> = {}) => NextResponse.json({ error, ...extra }, { status });

// C3 salary-card file for an approved run: everyone in the run who has a C3 ID on their profile, with what they are to be
// paid. Workers without a C3 ID are not in it (they are paid through the bank or in cash).
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { user, branchId, isSuperAdmin } = await requireUserWithBranch();
  if (!can(subjectOf(user), "payroll.payroll", "export")) return fail("You don't have permission to export payroll.", 403);
  const { id } = await params;
  const run = await prisma.payrollRun.findUnique({
    where: { id },
    include: { lines: { include: { employee: { select: { name: true, employeeIdNo: true, c3Id: true } } } }, company: { select: { name: true } } },
  });
  if (!run || isOutsideBranch(run.branchId, branchId, isSuperAdmin)) return fail("Run not found.", 404);
  if (run.status === "DRAFT") return fail("Approve the run before generating the C3 file.");

  const paid = run.lines.filter((l) => !!l.employee.c3Id?.trim()).sort((a, b) => a.employee.name.localeCompare(b.employee.name));
  if (paid.length === 0) return fail("Nobody in this run has a C3 ID. Add it on the worker's Payroll & WPS tab.");

  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("C3");
  ws.addRow(["C3 ID", "Employee ID", "Employee name", "Net pay (AED)", "Month", "Company"]);
  const head = ws.getRow(1);
  head.font = { bold: true };
  head.eachCell((c) => { c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFEDEBFB" } }; });
  ws.views = [{ state: "frozen", ySplit: 1 }];
  for (const l of paid) ws.addRow([l.employee.c3Id!.trim(), l.employee.employeeIdNo, l.employee.name, Number(l.net), run.month, run.company?.name ?? ""]);
  const total = paid.reduce((s, l) => s + Number(l.net), 0);
  const sum = ws.addRow(["", "", "Total", Math.round(total * 100) / 100, "", ""]);
  sum.font = { bold: true };
  ws.getColumn(4).numFmt = "#,##0.00";
  [16, 14, 34, 16, 10, 30].forEach((w, i) => { ws.getColumn(i + 1).width = w; });

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
