import { NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { prisma } from "@/lib/db";
import { requireUserWithBranch, subjectOf } from "@/lib/auth";
import { branchWhere } from "@/lib/branch";
import { can } from "@/lib/permissions";
import { advanceRef, advanceState } from "@/lib/advances";

const HEADINGS = ["Ref", "Employee code", "Employee", "Type", "Amount borrowed", "Repaid", "Balance", "Monthly deduction", "Deduct from", "Status", "Handed over on", "Approved by", "Requested by", "Requested on", "Reason"];

/** Every loan and advance for the company as one table, in the same columns the opening-balance import reads. */
export async function GET(request: Request) {
  const { user, branchId } = await requireUserWithBranch();
  if (!can(subjectOf(user), "payroll.payroll", "view")) return NextResponse.json({ error: "You don't have access to loans and advances." }, { status: 403 });
  const loans = await prisma.employeeLoan.findMany({
    where: branchWhere(branchId),
    orderBy: { createdAt: "desc" },
    include: { employee: { select: { name: true, employeeIdNo: true } } },
  });
  const people = await prisma.user.findMany({ where: { id: { in: [...new Set(loans.flatMap((l) => [l.createdById, l.approvedById].filter((x): x is string => !!x)))] } }, select: { id: true, name: true } });
  const nameOf = new Map(people.map((u) => [u.id, u.name]));
  const num = (d: { toString(): string }) => Number(d.toString());

  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Loans & advances");
  const head = ws.addRow(HEADINGS);
  head.font = { bold: true };
  head.eachCell((c) => { c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFEDEBFB" } }; });
  ws.views = [{ state: "frozen", ySplit: 1 }];
  [11, 14, 26, 10, 16, 12, 12, 16, 12, 18, 14, 20, 20, 14, 36].forEach((w, i) => { ws.getColumn(i + 1).width = w; });
  for (const l of loans) {
    const principal = num(l.principal), repaid = num(l.repaid);
    const state = advanceState({ approvalStatus: l.approvalStatus, status: l.status, givenDate: l.givenDate, principal, repaid });
    ws.addRow([
      advanceRef(l.refNo), l.employee.employeeIdNo, l.employee.name, l.type === "LOAN" ? "Loan" : "Advance", principal, repaid, Math.round((principal - repaid) * 100) / 100, num(l.instalment), l.startMonth,
      state.label, l.givenDate ? l.givenDate.toISOString().slice(0, 10) : "", l.approvedById ? nameOf.get(l.approvedById) ?? "" : "", nameOf.get(l.createdById) ?? "", l.createdAt.toISOString().slice(0, 10), l.reason ?? "",
    ]);
  }
  ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: HEADINGS.length } };

  const stamp = new Date().toISOString().slice(0, 10);
  if (new URL(request.url).searchParams.get("format") === "csv") {
    const csv = Buffer.from(await wb.csv.writeBuffer());
    return new NextResponse(new Uint8Array(csv), { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="loans-and-advances-${stamp}.csv"` } });
  }
  const buf = Buffer.from(await wb.xlsx.writeBuffer());
  return new NextResponse(new Uint8Array(buf), { headers: { "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "Content-Disposition": `attachment; filename="loans-and-advances-${stamp}.xlsx"` } });
}
