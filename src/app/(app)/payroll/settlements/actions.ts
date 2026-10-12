"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireUserWithBranch, requirePermission, requireWrite } from "@/lib/auth";
import { isOutsideBranch } from "@/lib/branch";
import { logAudit } from "@/lib/audit";
import { loadPayOf } from "@/lib/payrollRun";
import { round2 } from "@/lib/payroll";
import { computeSettlement, unpaidDaysDefault } from "@/lib/settlement";
import { anotherApproverExists } from "@/lib/payrollControls";

type State = { error: string | null; ok?: boolean };

const num = (d: { toString(): string } | null | undefined) => (d == null ? 0 : Number(d.toString()));
const amount = (v: FormDataEntryValue | null) => { const raw = String(v ?? "").trim(); const n = raw === "" ? 0 : Number(raw); return Number.isFinite(n) ? round2(n) : NaN; };
const dateOf = (v: FormDataEntryValue | null) => { const s = String(v ?? "").trim(); if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null; const d = new Date(`${s}T00:00:00.000Z`); return Number.isNaN(d.getTime()) ? null : d; };

/** What the settlement is built from for one employee: their pay, loans and whether a payroll run already pays the exit month. */
async function facts(employeeId: string, exitDate: Date) {
  const e = await prisma.employee.findUnique({
    where: { id: employeeId },
    select: {
      id: true, name: true, branchId: true, joinDate: true, supplierId: true, trade: true, position: true, payOverride: true, payStructure: true, basicSalary: true, housingAllowance: true, foodAllowance: true,
      transportAllowance: true, otherAllowance: true, flatMonthlyRate: true, hourlyRate: true, dailyHours: true, paysOvertime: true, otMultiplier: true, restOtMultiplier: true,
      supplier: { select: { isOwnCompany: true } }, skills: { select: { rate: true, isActive: true, skill: { select: { name: true } } } },
    },
  });
  if (!e) return null;
  const pf = (await loadPayOf(e.branchId, [e]))(e);
  const basic = pf.payStructure === "FLAT" ? pf.flatMonthlyRate : pf.payStructure === "ITEMISED" ? pf.basicSalary : 0;
  const fixed = pf.payStructure === "FLAT" ? pf.flatMonthlyRate : pf.payStructure === "ITEMISED" ? pf.basicSalary + pf.housingAllowance + pf.foodAllowance + pf.transportAllowance + pf.otherAllowance : 0;
  const month = exitDate.toISOString().slice(0, 7);
  const covered = (await prisma.payrollLine.count({ where: { employeeId, run: { month, branchId: e.branchId } } })) > 0;
  const loans = await prisma.employeeLoan.findMany({ where: { employeeId, status: "ACTIVE" }, select: { principal: true, repaid: true } });
  const loanBalance = round2(loans.reduce((s, l) => s + Math.max(0, num(l.principal) - num(l.repaid)), 0));
  return { e, basic: round2(basic), fixed: round2(fixed), covered, loanBalance };
}

async function loadSettlement(id: string) {
  const { user, branchId, isSuperAdmin } = await requireUserWithBranch();
  const s = await prisma.finalSettlement.findUnique({ where: { id }, include: { employee: { select: { id: true, name: true } } } });
  if (!s || isOutsideBranch(s.branchId, branchId, isSuperAdmin)) return { user, s: null };
  return { user, s };
}

export async function createSettlementAction(_prev: State, formData: FormData): Promise<State> {
  await requireWrite("payroll.payroll");
  await requirePermission("payroll.payroll", "create");
  const { user, branchId, isSuperAdmin } = await requireUserWithBranch();
  if (!branchId) return { error: "Pick a branch from the switcher first." };
  const employeeId = String(formData.get("employeeId") || "");
  const exitDate = dateOf(formData.get("exitDate"));
  const reason = String(formData.get("reason") || "").trim().slice(0, 80) || null;
  if (!employeeId) return { error: "Choose the employee who is leaving." };
  if (!exitDate) return { error: "Enter the last working day." };
  const f = await facts(employeeId, exitDate);
  if (!f || isOutsideBranch(f.e.branchId, branchId, isSuperAdmin)) return { error: "Employee not found." };
  if (!f.e.supplier?.isOwnCompany) return { error: "Settlements are for employees of your own companies." };
  if (f.e.joinDate && exitDate < f.e.joinDate) return { error: "The last working day can't be before the join date." };
  if (await prisma.finalSettlement.count({ where: { employeeId, status: { in: ["DRAFT", "APPROVED"] } } }) > 0) return { error: `${f.e.name} already has a settlement that isn't finished.` };

  const days = unpaidDaysDefault(exitDate, f.covered);
  const r = computeSettlement({ basicMonthly: f.basic, fixedMonthly: f.fixed, joinDate: f.e.joinDate, exitDate, unpaidSalaryDays: days, leavePay: 0, noticePay: 0, otherEarnings: 0, loanBalance: f.loanBalance, otherDeductions: 0 });
  const created = await prisma.finalSettlement.create({
    data: { branchId, employeeId, status: "DRAFT", exitDate, reason, serviceYears: r.serviceYears, basic: f.basic, gratuity: r.gratuity, unpaidSalaryDays: days, unpaidSalary: r.unpaidSalary, loanBalance: f.loanBalance, net: r.net, createdById: user.id },
  });
  await logAudit({ entityType: "FINAL_SETTLEMENT", entityId: created.id, action: "CREATE", after: { employee: f.e.name, exitDate: exitDate.toISOString().slice(0, 10), net: r.net }, userId: user.id, userName: user.name, branchId });
  revalidatePath("/payroll/settlements");
  redirect(`/payroll/settlements/${created.id}`);
}

/** Saves the typed figures on a draft and recalculates everything that follows from them. */
export async function updateSettlementAction(_prev: State, formData: FormData): Promise<State> {
  await requireWrite("payroll.payroll");
  await requirePermission("payroll.payroll", "edit");
  const { user, s } = await loadSettlement(String(formData.get("id") || ""));
  if (!s) return { error: "Settlement not found." };
  if (s.status !== "DRAFT") return { error: "Only a draft can be changed." };
  const exitDate = dateOf(formData.get("exitDate"));
  if (!exitDate) return { error: "Enter the last working day." };
  const typed = { basic: amount(formData.get("basic")), leavePay: amount(formData.get("leavePay")), noticePay: amount(formData.get("noticePay")), otherEarnings: amount(formData.get("otherEarnings")), otherDeductions: amount(formData.get("otherDeductions")), loanBalance: amount(formData.get("loanBalance")) };
  const days = Number(String(formData.get("unpaidSalaryDays") || "0"));
  if (![...Object.values(typed), days].every((x) => Number.isFinite(x) && x >= 0) || Object.values(typed).some((x) => x > 10_000_000) || days > 31) return { error: "Enter valid amounts. None can be negative, and unpaid days can't be more than 31." };
  if (typed.otherDeductions > 0 && !String(formData.get("notes") || "").trim()) return { error: "Add a note saying what the other deduction is for." };

  const f = await facts(s.employeeId, exitDate);
  if (!f) return { error: "Employee not found." };
  const r = computeSettlement({ basicMonthly: typed.basic, fixedMonthly: f.fixed > 0 ? f.fixed : typed.basic, joinDate: f.e.joinDate, exitDate, unpaidSalaryDays: Math.round(days), leavePay: typed.leavePay, noticePay: typed.noticePay, otherEarnings: typed.otherEarnings, loanBalance: typed.loanBalance, otherDeductions: typed.otherDeductions });
  const reason = String(formData.get("reason") || "").trim().slice(0, 80) || null;
  await prisma.finalSettlement.update({
    where: { id: s.id },
    data: { exitDate, reason, serviceYears: r.serviceYears, basic: typed.basic, gratuity: r.gratuity, unpaidSalaryDays: Math.round(days), unpaidSalary: r.unpaidSalary, leavePay: typed.leavePay, noticePay: typed.noticePay, otherEarnings: typed.otherEarnings, loanBalance: typed.loanBalance, otherDeductions: typed.otherDeductions, net: r.net, notes: String(formData.get("notes") || "").trim().slice(0, 500) || null },
  });
  await logAudit({ entityType: "FINAL_SETTLEMENT", entityId: s.id, action: "UPDATE", before: { net: num(s.net) }, after: { net: r.net, employee: s.employee.name }, userId: user.id, userName: user.name, branchId: s.branchId });
  revalidatePath(`/payroll/settlements/${s.id}`);
  return { error: null, ok: true };
}

export async function approveSettlementAction(formData: FormData): Promise<State> {
  await requireWrite("payroll.payroll");
  await requirePermission("payroll.payroll", "approve");
  const { user, s } = await loadSettlement(String(formData.get("id") || ""));
  if (!s) return { error: "Settlement not found." };
  if (s.status !== "DRAFT") return { error: "Already approved." };
  if (s.createdById === user.id && (await anotherApproverExists(s.branchId, user.id))) return { error: "Someone other than the person who prepared this settlement has to approve it." };

  await prisma.$transaction(async (tx) => {
    await tx.finalSettlement.update({ where: { id: s.id }, data: { status: "APPROVED", approvedAt: new Date(), approvedById: user.id } });
    // The person has left: payroll stops at their last day, and what they owed on loans is settled here.
    await tx.employee.update({ where: { id: s.employeeId }, data: { exitDate: s.exitDate, active: false, exitReason: s.reason, inactiveReason: s.reason } });
    if (num(s.loanBalance) > 0) {
      const loans = await tx.employeeLoan.findMany({ where: { employeeId: s.employeeId, status: "ACTIVE" } });
      for (const l of loans) await tx.employeeLoan.update({ where: { id: l.id }, data: { repaid: l.principal, status: "CLEARED", reason: `${l.reason ? `${l.reason} · ` : ""}Recovered in final settlement` } });
    }
  });
  await logAudit({ entityType: "FINAL_SETTLEMENT", entityId: s.id, action: "UPDATE", before: { status: "DRAFT" }, after: { status: "APPROVED", net: num(s.net), employee: s.employee.name }, userId: user.id, userName: user.name, branchId: s.branchId });
  revalidatePath(`/payroll/settlements/${s.id}`);
  revalidatePath("/payroll/settlements");
  return { error: null, ok: true };
}

export async function markSettlementPaidAction(formData: FormData): Promise<State> {
  await requireWrite("payroll.payroll");
  await requirePermission("payroll.payroll", "approve");
  const { user, s } = await loadSettlement(String(formData.get("id") || ""));
  if (!s) return { error: "Settlement not found." };
  if (s.status !== "APPROVED") return { error: "Approve the settlement before marking it paid." };
  await prisma.finalSettlement.update({ where: { id: s.id }, data: { status: "PAID", paidAt: new Date() } });
  await logAudit({ entityType: "FINAL_SETTLEMENT", entityId: s.id, action: "UPDATE", before: { status: "APPROVED" }, after: { status: "PAID", employee: s.employee.name }, userId: user.id, userName: user.name, branchId: s.branchId });
  revalidatePath(`/payroll/settlements/${s.id}`);
  revalidatePath("/payroll/settlements");
  return { error: null, ok: true };
}

export async function deleteSettlementAction(formData: FormData) {
  await requireWrite("payroll.payroll");
  await requirePermission("payroll.payroll", "delete");
  const { user, s } = await loadSettlement(String(formData.get("id") || ""));
  if (!s || s.status !== "DRAFT") return;
  await prisma.finalSettlement.delete({ where: { id: s.id } });
  await logAudit({ entityType: "FINAL_SETTLEMENT", entityId: s.id, action: "DELETE", before: { employee: s.employee.name, net: num(s.net) }, userId: user.id, userName: user.name, branchId: s.branchId });
  revalidatePath("/payroll/settlements");
  redirect("/payroll/settlements");
}
