import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUserWithBranch, subjectOf } from "@/lib/auth";
import { isOutsideBranch } from "@/lib/branch";
import { can } from "@/lib/permissions";
import { lineToPayslipLine } from "@/lib/payslipData";
import { buildJournal, csvCell } from "@/lib/payrollReports";

// The accounting entry for a run, one block per project, ready to import into the books.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { user, branchId, isSuperAdmin } = await requireUserWithBranch();
  if (!can(subjectOf(user), "payroll.payroll", "export")) return NextResponse.json({ error: "You don't have permission to export payroll." }, { status: 403 });
  const { id } = await params;
  const run = await prisma.payrollRun.findUnique({ where: { id }, include: { lines: true, company: { select: { name: true } } } });
  if (!run || isOutsideBranch(run.branchId, branchId, isSuperAdmin)) return NextResponse.json({ error: "Run not found." }, { status: 404 });
  if (run.status === "DRAFT") return NextResponse.json({ error: "Approve the run before exporting its journal." }, { status: 400 });

  const projectIds = [...new Set(run.lines.map((l) => l.projectId).filter((x): x is string => !!x))];
  const projects = projectIds.length ? await prisma.project.findMany({ where: { id: { in: projectIds } }, select: { id: true, code: true } }) : [];
  const code = new Map(projects.map((p) => [p.id, p.code]));
  const rows = buildJournal(run.lines.map((l) => ({ costCentre: l.projectId ? (code.get(l.projectId) ?? "REMOVED") : "UNASSIGNED", line: lineToPayslipLine(l) })));
  const date = run.approvedAt ?? new Date();
  const memo = `Payroll ${run.month}${run.company ? ` ${run.company.name}` : ""}`;
  const csv = ["Date,Reference,Account,Debit,Credit,Cost centre,Memo", ...rows.map((r) => [date.toISOString().slice(0, 10), `PAY-${run.month}`, r.account, r.debit ? r.debit.toFixed(2) : "", r.credit ? r.credit.toFixed(2) : "", r.costCentre, memo].map(csvCell).join(","))].join("\r\n");
  return new NextResponse(csv, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="payroll-journal-${run.month}.csv"`, "Cache-Control": "private, no-store" } });
}
