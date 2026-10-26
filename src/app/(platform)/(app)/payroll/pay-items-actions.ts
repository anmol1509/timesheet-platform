"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireUserWithBranch, requirePermission, requireWrite } from "@/lib/auth";
import { isOutsideBranch } from "@/lib/branch";
import { logAudit } from "@/lib/audit";
import { monthBounds, round2 } from "@/lib/payroll";
import { arrearsFor } from "@/lib/payrollSchedule";
import { cleanCategory } from "@/lib/payItems";
import { assertContactsValid, contactsError } from "@/lib/validators";
import { advanceRef, buildRecoveryPlan } from "@/lib/advances";
import { anotherApproverExists } from "@/lib/payrollControls";
import { approverIds, notifyUsers } from "@/lib/notifications/notify";

type State = { error: string | null; ok?: boolean };
const str = (v: FormDataEntryValue | null) => String(v ?? "").trim();
const money = (v: FormDataEntryValue | null) => {
  const n = Number(str(v) || 0);
  return Number.isFinite(n) ? round2(n) : NaN;
};

async function employeeInBranch(employeeId: string, branchId: string) {
  const e = await prisma.employee.findUnique({ where: { id: employeeId }, select: { id: true, name: true, branchId: true } });
  return e && e.branchId === branchId ? e : null;
}

// ------------------------------------------------------- loans & advances
// An advance is a request first: it is approved by someone, handed over on a recorded day, and only then recovered
// from payroll, month by month, as planned. Each step is recorded against the person who did it.
const METHODS = new Set(["CASH", "BANK", "OTHER"]);

async function loanInBranch(id: string, branchId: string | null, isSuperAdmin: boolean) {
  const loan = await prisma.employeeLoan.findUnique({ where: { id }, include: { employee: { select: { name: true } } } });
  return loan && !isOutsideBranch(loan.branchId, branchId, isSuperAdmin) ? loan : null;
}

export async function createLoanAction(_prev: State, formData: FormData): Promise<State> {
  await requireWrite("payroll.payroll");
  { const invalid = contactsError(formData); if (invalid) return { error: invalid }; }
  await requirePermission("payroll.payroll", "create");
  const { user, branchId } = await requireUserWithBranch();
  if (!branchId) return { error: "Pick a branch from the switcher first." };

  const emp = await employeeInBranch(str(formData.get("employeeId")), branchId);
  if (!emp) return { error: "Choose an employee." };
  const type = str(formData.get("type")) === "LOAN" ? "LOAN" : "ADVANCE";
  const principal = money(formData.get("principal"));
  const reason = str(formData.get("reason")).slice(0, 300);
  if (!reason) return { error: "Say what the advance is for, so whoever approves it knows." };

  const mode = str(formData.get("planMode"));
  let rows: { month: string; amount: number }[] = [];
  if (mode === "CUSTOM") {
    try {
      const raw = JSON.parse(str(formData.get("planRows")) || "[]") as { month?: unknown; amount?: unknown }[];
      rows = raw.map((r) => ({ month: String(r.month ?? ""), amount: Number(r.amount) }));
    } catch {
      return { error: "The month-by-month plan couldn't be read. Add the rows again." };
    }
  }
  const plan = buildRecoveryPlan(
    mode === "CUSTOM" ? { mode: "CUSTOM", principal, rows }
    : mode === "EQUAL" ? { mode: "EQUAL", principal, startMonth: str(formData.get("startMonth")), instalment: money(formData.get("instalment")) }
    : { mode: "ONE_MONTH", principal, month: str(formData.get("month")) }
  );
  if ("error" in plan) return { error: plan.error };

  const loan = await prisma.employeeLoan.create({
    data: {
      type, principal, instalment: plan.instalment, startMonth: plan.startMonth, schedule: plan.schedule ?? undefined, reason,
      approvalStatus: "PENDING", employeeId: emp.id, branchId, createdById: user.id,
    },
  });
  await logAudit({ entityType: "EMPLOYEE_LOAN", entityId: loan.id, action: "CREATE", after: { ref: advanceRef(loan.refNo), employee: emp.name, type, principal, startMonth: plan.startMonth, instalment: plan.instalment, planned: !!plan.schedule }, userId: user.id, userName: user.name, branchId });
  await notifyUsers({
    userIds: (await approverIds("payroll", branchId)).filter((id) => id !== user.id),
    kind: "ADVANCE_REQUESTED",
    title: `Advance to approve: ${emp.name}`,
    body: `${user.name} asked for ${type === "LOAN" ? "a loan" : "an advance"} of AED ${principal.toFixed(2)} for ${emp.name}.`,
    href: "/approvals?type=ADVANCE",
  });
  revalidatePath("/payroll/loans");
  revalidatePath("/approvals");
  return { error: null, ok: true };
}

/** An approver accepts a request. The person who asked cannot approve their own request when someone else can. */
export async function approveAdvanceAction(formData: FormData): Promise<State> {
  await requireWrite("payroll.payroll");
  { const invalid = contactsError(formData); if (invalid) return { error: invalid }; }
  await requirePermission("payroll.payroll", "approve");
  const { user, branchId, isSuperAdmin } = await requireUserWithBranch();
  const loan = await loanInBranch(str(formData.get("id")), branchId, isSuperAdmin);
  if (!loan) return { error: "Request not found." };
  if (loan.approvalStatus !== "PENDING" || loan.status !== "ACTIVE") return { error: "That request has already been decided." };
  // Admins may approve their own request (recorded in the audit log); other approvers still need someone else.
  const isAdmin = user.role === "SUPER_ADMIN" || user.role === "BRANCH_ADMIN";
  const selfApproved = loan.createdById === user.id;
  if (selfApproved && !isAdmin && (await anotherApproverExists(loan.branchId, user.id))) return { error: "Someone other than the person who asked for the advance has to approve it." };
  await prisma.employeeLoan.update({ where: { id: loan.id }, data: { approvalStatus: "APPROVED", approvedById: user.id, approvedAt: new Date(), decisionNote: null } });
  await logAudit({ entityType: "EMPLOYEE_LOAN", entityId: loan.id, action: "UPDATE", before: { approval: "PENDING" }, after: { approval: "APPROVED", ref: advanceRef(loan.refNo), employee: loan.employee.name, ...(selfApproved ? { approvedOwnRequest: true } : {}) }, userId: user.id, userName: user.name, branchId: loan.branchId });
  await notifyUsers({ userIds: [loan.createdById].filter((id) => id !== user.id), kind: "ADVANCE_DECIDED", title: `Advance approved: ${loan.employee.name}`, body: `${advanceRef(loan.refNo)} was approved by ${user.name}. Record the day it is handed over.`, href: "/payroll/loans" });
  revalidatePath("/payroll/loans");
  revalidatePath("/approvals");
  return { error: null, ok: true };
}

export async function rejectAdvanceAction(formData: FormData): Promise<State> {
  await requireWrite("payroll.payroll");
  { const invalid = contactsError(formData); if (invalid) return { error: invalid }; }
  await requirePermission("payroll.payroll", "approve");
  const { user, branchId, isSuperAdmin } = await requireUserWithBranch();
  const loan = await loanInBranch(str(formData.get("id")), branchId, isSuperAdmin);
  if (!loan) return { error: "Request not found." };
  if (loan.approvalStatus !== "PENDING" || loan.status !== "ACTIVE") return { error: "That request has already been decided." };
  const note = str(formData.get("note")).slice(0, 300);
  if (!note) return { error: "Say why it is being turned down." };
  await prisma.employeeLoan.update({ where: { id: loan.id }, data: { approvalStatus: "REJECTED", status: "CANCELLED", approvedById: user.id, approvedAt: new Date(), decisionNote: note } });
  await logAudit({ entityType: "EMPLOYEE_LOAN", entityId: loan.id, action: "UPDATE", before: { approval: "PENDING" }, after: { approval: "REJECTED", note, ref: advanceRef(loan.refNo), employee: loan.employee.name }, userId: user.id, userName: user.name, branchId: loan.branchId });
  await notifyUsers({ userIds: [loan.createdById].filter((id) => id !== user.id), kind: "ADVANCE_DECIDED", title: `Advance not approved: ${loan.employee.name}`, body: `${advanceRef(loan.refNo)}: ${note}`, href: "/payroll/loans" });
  revalidatePath("/payroll/loans");
  revalidatePath("/approvals");
  return { error: null, ok: true };
}

/** Records the day the money was actually handed over, and how. Recovery from payroll follows the plan's months, whatever day this is. */
export async function markAdvanceGivenAction(formData: FormData): Promise<State> {
  await requireWrite("payroll.payroll");
  { const invalid = contactsError(formData); if (invalid) return { error: invalid }; }
  await requirePermission("payroll.payroll", "edit");
  const { user, branchId, isSuperAdmin } = await requireUserWithBranch();
  const loan = await loanInBranch(str(formData.get("id")), branchId, isSuperAdmin);
  if (!loan) return { error: "Advance not found." };
  if (loan.approvalStatus !== "APPROVED" || loan.status !== "ACTIVE") return { error: "Only an approved advance can be marked as given." };
  if (loan.givenDate) return { error: "The day it was given is already recorded." };
  const day = str(formData.get("givenDate"));
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || Number.isNaN(Date.parse(day))) return { error: "Enter the day the money was handed over." };
  const givenDate = new Date(`${day}T00:00:00.000Z`);
  if (givenDate.getTime() > Date.now() + 86_400_000) return { error: "That day is in the future. Record it once the money has been handed over." };
  const method = METHODS.has(str(formData.get("method"))) ? str(formData.get("method")) : "CASH";
  const reference = str(formData.get("reference")).slice(0, 80) || null;
  await prisma.employeeLoan.update({ where: { id: loan.id }, data: { givenDate, method, reference } });
  await logAudit({ entityType: "EMPLOYEE_LOAN", entityId: loan.id, action: "UPDATE", before: { givenDate: null }, after: { givenDate: day, method, reference, ref: advanceRef(loan.refNo), employee: loan.employee.name }, userId: user.id, userName: user.name, branchId: loan.branchId });
  revalidatePath("/payroll/loans");
  return { error: null, ok: true };
}

export async function cancelLoanAction(formData: FormData): Promise<State> {
  await requireWrite("payroll.payroll");
  { const invalid = contactsError(formData); if (invalid) return { error: invalid }; }
  await requirePermission("payroll.payroll", "edit");
  const { user, branchId, isSuperAdmin } = await requireUserWithBranch();
  const loan = await prisma.employeeLoan.findUnique({ where: { id: str(formData.get("id")) }, include: { employee: { select: { name: true } } } });
  if (!loan || isOutsideBranch(loan.branchId, branchId, isSuperAdmin)) return { error: "Loan not found." };
  if (loan.status !== "ACTIVE") return { error: "Only an active loan can be cancelled." };
  // Stops future deductions; what was already recovered stays recorded.
  await prisma.employeeLoan.update({ where: { id: loan.id }, data: { status: "CANCELLED" } });
  await logAudit({ entityType: "EMPLOYEE_LOAN", entityId: loan.id, action: "UPDATE", before: { status: "ACTIVE" }, after: { status: "CANCELLED", employee: loan.employee.name, repaid: Number(loan.repaid) }, userId: user.id, userName: user.name, branchId: loan.branchId });
  revalidatePath("/payroll/loans");
  return { error: null, ok: true };
}

// ---------------------------------------------- recurring earnings / deductions
export async function createAdjustmentAction(_prev: State, formData: FormData): Promise<State> {
  await requireWrite("payroll.payroll");
  { const invalid = contactsError(formData); if (invalid) return { error: invalid }; }
  await requirePermission("payroll.payroll", "create");
  const { user, branchId } = await requireUserWithBranch();
  if (!branchId) return { error: "Pick a branch from the switcher first." };

  const emp = await employeeInBranch(str(formData.get("employeeId")), branchId);
  if (!emp) return { error: "Choose an employee." };
  const kind = str(formData.get("kind")) === "DEDUCTION" ? "DEDUCTION" : "EARNING";
  const label = str(formData.get("label"));
  const amount = money(formData.get("amount"));
  const startMonth = str(formData.get("startMonth"));
  const endMonth = str(formData.get("endMonth")) || null;
  if (!label) return { error: "Give it a name, e.g. Phone allowance." };
  if (!(amount > 0)) return { error: "Enter a monthly amount above zero." };
  if (!monthBounds(startMonth)) return { error: "Choose the first month." };
  if (endMonth && (!monthBounds(endMonth) || endMonth < startMonth)) return { error: "The last month can't be before the first." };

  const category = cleanCategory(str(formData.get("category")));
  const row = await prisma.payrollAdjustment.create({ data: { kind, category, label, amount, startMonth, endMonth, employeeId: emp.id, branchId, createdById: user.id } });
  await logAudit({ entityType: "PAYROLL_ADJUSTMENT", entityId: row.id, action: "CREATE", after: { employee: emp.name, kind, category, label, amount, startMonth, endMonth }, userId: user.id, userName: user.name, branchId });
  revalidatePath("/payroll/recurring");
  return { error: null, ok: true };
}

export async function toggleAdjustmentAction(formData: FormData): Promise<State> {
  await requireWrite("payroll.payroll");
  { const invalid = contactsError(formData); if (invalid) return { error: invalid }; }
  await requirePermission("payroll.payroll", "edit");
  const { user, branchId, isSuperAdmin } = await requireUserWithBranch();
  const row = await prisma.payrollAdjustment.findUnique({ where: { id: str(formData.get("id")) }, include: { employee: { select: { name: true } } } });
  if (!row || isOutsideBranch(row.branchId, branchId, isSuperAdmin)) return { error: "Not found." };
  await prisma.payrollAdjustment.update({ where: { id: row.id }, data: { active: !row.active } });
  await logAudit({ entityType: "PAYROLL_ADJUSTMENT", entityId: row.id, action: "UPDATE", before: { active: row.active }, after: { active: !row.active, employee: row.employee.name, label: row.label }, userId: user.id, userName: user.name, branchId: row.branchId });
  revalidatePath("/payroll/recurring");
  return { error: null, ok: true };
}

/** A pay rise that took effect in months already paid: add what was missed to the next payroll as one arrears item. */
export async function addArrearsAction(formData: FormData): Promise<State> {
  await requireWrite("payroll.payroll");
  { const invalid = contactsError(formData); if (invalid) return { error: invalid }; }
  await requirePermission("payroll.payroll", "create");
  const { user, branchId, isSuperAdmin } = await requireUserWithBranch();
  const rev = await prisma.salaryRevision.findUnique({ where: { id: str(formData.get("revisionId")) }, include: { employee: { select: { name: true } } } });
  if (!rev || isOutsideBranch(rev.branchId, branchId, isSuperAdmin)) return { error: "Salary change not found." };
  const increase = round2(Number(rev.fixedAfter.toString()) - Number(rev.fixedBefore.toString()));
  if (!(increase > 0)) return { error: "This change was not an increase, so there are no arrears." };
  const closed = await prisma.payrollRun.findMany({ where: { branchId: rev.branchId, status: { in: ["APPROVED", "PAID"] }, lines: { some: { employeeId: rev.employeeId } } }, select: { month: true } });
  const closedMonths = [...new Set(closed.map((r) => r.month))];
  const a = arrearsFor(increase, rev.effectiveFrom, closedMonths);
  if (a.months.length === 0) return { error: "No payroll has been approved since this change took effect, so the next run already pays the new rate." };
  const [y, m] = a.months[a.months.length - 1].split("-").map(Number);
  const next = new Date(Date.UTC(y, m, 1));
  const month = `${next.getUTCFullYear()}-${String(next.getUTCMonth() + 1).padStart(2, "0")}`;
  const label = `Salary arrears ${a.months[0]} to ${a.months[a.months.length - 1]}`;
  const dup = await prisma.payrollAdjustment.findFirst({ where: { employeeId: rev.employeeId, category: "ARREARS", label } });
  if (dup) return { error: "These arrears have already been added to a payroll." };
  const row = await prisma.payrollAdjustment.create({ data: { kind: "EARNING", category: "ARREARS", label, amount: a.amount, startMonth: month, endMonth: month, employeeId: rev.employeeId, branchId: rev.branchId, createdById: user.id } });
  await logAudit({ entityType: "PAYROLL_ADJUSTMENT", entityId: row.id, action: "CREATE", after: { employee: rev.employee.name, label, amount: a.amount, appliesTo: month }, userId: user.id, userName: user.name, branchId: rev.branchId });
  revalidatePath(`/employees/${rev.employeeId}`);
  revalidatePath("/payroll/recurring");
  return { error: null, ok: true };
}
