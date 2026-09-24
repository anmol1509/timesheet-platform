import { prisma } from "@/lib/db";
import { requireUserWithBranch, subjectOf } from "@/lib/auth";
import { branchWhere } from "@/lib/branch";
import { can } from "@/lib/permissions";
import { PageHeader } from "@/components/PageHeader";
import { RecurringBoard, type RecurringRow } from "./recurring-board";

export const metadata = { title: "Recurring pay items" };

export default async function RecurringPage() {
  const { user, branchId } = await requireUserWithBranch();
  const subject = subjectOf(user);
  const [items, employees] = await Promise.all([
    prisma.payrollAdjustment.findMany({
      where: branchWhere(branchId),
      orderBy: [{ active: "desc" }, { createdAt: "desc" }],
      include: { employee: { select: { name: true, employeeIdNo: true } } },
    }),
    branchId
      ? prisma.employee.findMany({ where: { branchId, status: { not: "TERMINATED" } }, select: { id: true, name: true, employeeIdNo: true }, orderBy: { name: "asc" } })
      : [],
  ]);

  const rows: RecurringRow[] = items.map((a) => ({
    id: a.id,
    employee: a.employee.name,
    employeeIdNo: a.employee.employeeIdNo,
    kind: a.kind,
    label: a.label,
    amount: Number(a.amount.toString()),
    startMonth: a.startMonth,
    endMonth: a.endMonth,
    active: a.active,
  }));

  return (
    <div className="space-y-5">
      <PageHeader
        title="Recurring pay items"
        description="Standing earnings and deductions, such as a phone allowance or a monthly fine, applied to every payroll run in their date range."
      />
      <RecurringBoard
        rows={rows}
        employees={employees.map((e) => ({ id: e.id, label: `${e.name} (${e.employeeIdNo})` }))}
        canCreate={!!branchId && can(subject, "payroll", "create")}
        canEdit={can(subject, "payroll", "edit")}
      />
    </div>
  );
}
