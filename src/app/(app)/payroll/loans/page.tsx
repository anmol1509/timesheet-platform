import { prisma } from "@/lib/db";
import { requireUserWithBranch, subjectOf } from "@/lib/auth";
import { branchWhere } from "@/lib/branch";
import { can } from "@/lib/permissions";
import { PageHeader } from "@/components/PageHeader";
import { LoansBoard, type LoanRow } from "./loans-board";

export const metadata = { title: "Loans & advances" };

export default async function LoansPage() {
  const { user, branchId } = await requireUserWithBranch();
  const subject = subjectOf(user);
  const [loans, employees] = await Promise.all([
    prisma.employeeLoan.findMany({
      where: branchWhere(branchId),
      orderBy: [{ status: "asc" }, { createdAt: "desc" }],
      include: { employee: { select: { name: true, employeeIdNo: true } } },
    }),
    branchId
      ? prisma.employee.findMany({
          where: { branchId, status: { not: "TERMINATED" } },
          select: { id: true, name: true, employeeIdNo: true },
          orderBy: { name: "asc" },
        })
      : [],
  ]);

  const n = (d: { toString(): string }) => Number(d.toString());
  const rows: LoanRow[] = loans.map((l) => ({
    id: l.id,
    employee: l.employee.name,
    employeeIdNo: l.employee.employeeIdNo,
    type: l.type,
    principal: n(l.principal),
    repaid: n(l.repaid),
    instalment: n(l.instalment),
    startMonth: l.startMonth,
    status: l.status,
    reason: l.reason,
  }));

  return (
    <div className="space-y-5">
      <PageHeader
        title="Loans & advances"
        description="Money advanced to employees, recovered automatically from each payroll run until it is cleared."
      />
      <LoansBoard
        rows={rows}
        employees={employees.map((e) => ({ id: e.id, label: `${e.name} (${e.employeeIdNo})` }))}
        canCreate={!!branchId && can(subject, "payroll", "create")}
        canEdit={can(subject, "payroll", "edit")}
      />
    </div>
  );
}
