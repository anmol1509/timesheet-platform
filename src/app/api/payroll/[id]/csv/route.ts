import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUserWithBranch, subjectOf } from "@/lib/auth";
import { isOutsideBranch } from "@/lib/branch";
import { can } from "@/lib/permissions";
import { toCsv } from "@/lib/csvExport";
import { logAudit } from "@/lib/audit";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { user, branchId, isSuperAdmin } = await requireUserWithBranch();
  if (!can(subjectOf(user), "payroll", "export")) return NextResponse.json({ error: "You don't have permission to export payroll." }, { status: 403 });

  const { id } = await params;
  const run = await prisma.payrollRun.findUnique({
    where: { id },
    include: { lines: { include: { employee: { select: { name: true, employeeIdNo: true } } }, orderBy: { employee: { name: "asc" } } } },
  });
  if (!run || isOutsideBranch(run.branchId, branchId, isSuperAdmin)) return NextResponse.json({ error: "Run not found." }, { status: 404 });

  const n = (d: { toString(): string }) => Number(d.toString());
  const csv = toCsv(
    ["Employee ID", "Name", "Structure", "Absent days", "Unpaid leave days", "OT hours", "Basic/flat", "Allowances", "Overtime", "Deductions", "Adjustment", "Adjustment note", "Net pay", "Payment mode", "Bank", "Account"],
    run.lines.map((l) => [l.employee.employeeIdNo, l.employee.name, l.payStructure, l.absentDays, l.unpaidLeaveDays, l.otHours, n(l.basic), n(l.allowances), n(l.overtimePay), n(l.deductions), n(l.adjustment), l.adjustmentNote, n(l.net), l.paymentMode, l.bankName, l.account])
  );
  await logAudit({ entityType: "PAYROLL_RUN", entityId: run.id, action: "UPDATE", after: { exported: "CSV" }, userId: user.id, userName: user.name, branchId: run.branchId });
  return new NextResponse(csv, {
    headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="payroll-${run.month}.csv"`, "Cache-Control": "no-store" },
  });
}
