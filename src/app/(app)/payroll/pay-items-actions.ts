"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireUserWithBranch, requirePermission } from "@/lib/auth";
import { isOutsideBranch } from "@/lib/branch";
import { logAudit } from "@/lib/audit";
import { monthBounds, round2 } from "@/lib/payroll";

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
export async function createLoanAction(_prev: State, formData: FormData): Promise<State> {
  await requirePermission("payroll", "create");
  const { user, branchId } = await requireUserWithBranch();
  if (!branchId) return { error: "Pick a branch from the switcher first." };

  const emp = await employeeInBranch(str(formData.get("employeeId")), branchId);
  if (!emp) return { error: "Choose an employee." };
  const type = str(formData.get("type")) === "ADVANCE" ? "ADVANCE" : "LOAN";
  const principal = money(formData.get("principal"));
  const instalment = money(formData.get("instalment"));
  const startMonth = str(formData.get("startMonth"));
  if (!(principal > 0)) return { error: "Enter the amount advanced." };
  if (!(instalment > 0) || instalment > principal) return { error: "The monthly recovery must be above zero and no more than the amount advanced." };
  if (!monthBounds(startMonth)) return { error: "Choose the first month to deduct." };

  const loan = await prisma.employeeLoan.create({
    data: { type, principal, instalment, startMonth, reason: str(formData.get("reason")) || null, employeeId: emp.id, branchId, createdById: user.id },
  });
  await logAudit({ entityType: "EMPLOYEE_LOAN", entityId: loan.id, action: "CREATE", after: { employee: emp.name, type, principal, instalment, startMonth }, userId: user.id, userName: user.name, branchId });
  revalidatePath("/payroll/loans");
  return { error: null, ok: true };
}

export async function cancelLoanAction(formData: FormData): Promise<State> {
  await requirePermission("payroll", "edit");
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
  await requirePermission("payroll", "create");
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

  const row = await prisma.payrollAdjustment.create({ data: { kind, label, amount, startMonth, endMonth, employeeId: emp.id, branchId, createdById: user.id } });
  await logAudit({ entityType: "PAYROLL_ADJUSTMENT", entityId: row.id, action: "CREATE", after: { employee: emp.name, kind, label, amount, startMonth, endMonth }, userId: user.id, userName: user.name, branchId });
  revalidatePath("/payroll/recurring");
  return { error: null, ok: true };
}

export async function toggleAdjustmentAction(formData: FormData): Promise<State> {
  await requirePermission("payroll", "edit");
  const { user, branchId, isSuperAdmin } = await requireUserWithBranch();
  const row = await prisma.payrollAdjustment.findUnique({ where: { id: str(formData.get("id")) }, include: { employee: { select: { name: true } } } });
  if (!row || isOutsideBranch(row.branchId, branchId, isSuperAdmin)) return { error: "Not found." };
  await prisma.payrollAdjustment.update({ where: { id: row.id }, data: { active: !row.active } });
  await logAudit({ entityType: "PAYROLL_ADJUSTMENT", entityId: row.id, action: "UPDATE", before: { active: row.active }, after: { active: !row.active, employee: row.employee.name, label: row.label }, userId: user.id, userName: user.name, branchId: row.branchId });
  revalidatePath("/payroll/recurring");
  return { error: null, ok: true };
}
