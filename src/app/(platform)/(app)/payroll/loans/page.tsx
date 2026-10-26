import { prisma } from "@/lib/db";
import { requireUserWithBranch, subjectOf } from "@/lib/auth";
import { branchWhere } from "@/lib/branch";
import { can } from "@/lib/permissions";
import { PageHeader } from "@/components/PageHeader";
import { advanceRef, advanceState, planRows, readSchedule } from "@/lib/advances";
import { LoansBoard, type LoanRow } from "./loans-board";

export const metadata = { title: "Loans & advances" };

export default async function LoansPage() {
  const { user, branchId } = await requireUserWithBranch();
  const subject = subjectOf(user);
  const [loans, employees] = await Promise.all([
    prisma.employeeLoan.findMany({
      where: branchWhere(branchId),
      orderBy: { createdAt: "desc" },
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
  const proofs = await prisma.attachment.findMany({ where: { entityType: "EMPLOYEE_LOAN", entityId: { in: loans.map((l) => l.id) } }, select: { id: true, entityId: true, filename: true }, orderBy: { uploadedAt: "asc" } });
  const people = await prisma.user.findMany({ where: { id: { in: [...new Set(loans.flatMap((l) => [l.createdById, l.approvedById].filter((x): x is string => !!x)))] } }, select: { id: true, name: true } });
  const nameOf = new Map(people.map((u) => [u.id, u.name]));
  const aed = (v: number) => v.toLocaleString("en-AE", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  const rows: LoanRow[] = loans.map((l) => {
    const principal = n(l.principal);
    const schedule = readSchedule(l.schedule);
    const plan = planRows({ principal, instalment: n(l.instalment), startMonth: l.startMonth, schedule });
    const state = advanceState({ approvalStatus: l.approvalStatus, status: l.status, givenDate: l.givenDate, principal, repaid: n(l.repaid) });
    return {
      id: l.id, ref: advanceRef(l.refNo), employeeId: l.employeeId, employee: l.employee.name, employeeIdNo: l.employee.employeeIdNo, type: l.type, principal, repaid: n(l.repaid), instalment: n(l.instalment), startMonth: l.startMonth,
      reason: l.reason, stateKey: state.key, stateLabel: state.label,
      planPending: l.planPending, repaidAny: n(l.repaid) > 0,
      files: proofs.filter((p) => p.entityId === l.id).map((p) => ({ id: p.id, name: p.filename })),
      plan: l.planPending ? "Month to be chosen" : plan.length === 1 ? `AED ${aed(plan[0].amount)} in ${plan[0].month}` : schedule ? `${plan.length} months: ${plan.slice(0, 3).map((p) => `${p.month} ${aed(p.amount)}`).join(", ")}${plan.length > 3 ? "…" : ""}` : `AED ${aed(n(l.instalment))} a month from ${l.startMonth}`,
      givenDate: l.givenDate ? l.givenDate.toISOString().slice(0, 10) : null,
      approvedBy: l.approvedById ? nameOf.get(l.approvedById) ?? null : null, decisionNote: l.decisionNote,
      requestedBy: nameOf.get(l.createdById) ?? "—", requestedOn: l.createdAt.toISOString().slice(0, 10), mine: l.createdById === user.id,
    };
  });

  return (
    <div className="space-y-5">
      <PageHeader
        title="Loans & advances"
        description="Requested, approved, handed over on a recorded day, then deducted from payroll month by month as planned."
      />
      <LoansBoard
        rows={rows}
        employees={employees.map((e) => ({ id: e.id, label: `${e.name} (${e.employeeIdNo})` }))}
        canCreate={!!branchId && can(subject, "payroll.payroll", "create")}
        canEdit={can(subject, "payroll.payroll", "edit")}
        canApprove={can(subject, "payroll.payroll", "approve")}
      />
    </div>
  );
}
