"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireUserWithBranch, requirePermission, requireView, requireWrite } from "@/lib/auth";
import { Prisma } from "@/generated/prisma/client";
import { rebuildRunLines } from "@/lib/payrollRun";
import { MAX_UPLOAD_BYTES, MAX_UPLOAD_LABEL } from "@/lib/constants";
import { isAcceptedUploadType } from "@/lib/uploads";
import { isOutsideBranch } from "@/lib/branch";
import { logAudit } from "@/lib/audit";
import { monthBounds, round2 } from "@/lib/payroll";
import { arrearsFor } from "@/lib/payrollSchedule";
import { cleanCategory } from "@/lib/payItems";
import { assertContactsValid, contactsError } from "@/lib/validators";
import { advanceRef, buildRecoveryPlan, loanInstalmentFor, planRows, readSchedule, withMonthAmount } from "@/lib/advances";
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

  // "Decide later": approved without a month, so it can be approved now and the month(s) chosen before payroll uses it.
  const later = str(formData.get("planMode")) === "LATER";
  const plan = later
    ? { startMonth: new Date().toISOString().slice(0, 7), instalment: principal, schedule: null }
    : planFromForm(formData, principal);
  if ("error" in plan) return { error: plan.error };
  if (!(principal > 0)) return { error: "Enter the amount advanced." };

  const loan = await prisma.employeeLoan.create({
    data: {
      type, principal, instalment: plan.instalment, startMonth: plan.startMonth, schedule: plan.schedule ?? undefined, reason,
      approvalStatus: "PENDING", planPending: later, employeeId: emp.id, branchId, createdById: user.id,
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
  await notifyUsers({ userIds: [loan.createdById].filter((id) => id !== user.id), kind: "ADVANCE_DECIDED", title: `Advance approved: ${loan.employee.name}`, body: `${advanceRef(loan.refNo)} was approved by ${user.name}. Record the day it is handed over.${loan.planPending ? " It has no deduction month yet: choose the month (or two) to deduct it in, under Loans & advances or from the payroll run." : ""}`, href: "/payroll/loans" });
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
  // Proof of the hand-over (a signed voucher, a transfer slip…): any files attached are kept with the advance.
  const files = formData.getAll("files").filter((f): f is File => f instanceof File && f.size > 0).slice(0, 5);
  for (const f of files) {
    if (f.size > MAX_UPLOAD_BYTES) return { error: `${f.name} is ${(f.size / 1024 / 1024).toFixed(1)}MB — the limit is ${MAX_UPLOAD_LABEL}.` };
    if (!isAcceptedUploadType(f.type)) return { error: `${f.name}: attach a PDF or a photo.` };
  }
  await prisma.employeeLoan.update({ where: { id: loan.id }, data: { givenDate, method, reference } });
  for (const f of files) {
    await prisma.attachment.create({ data: { entityType: "EMPLOYEE_LOAN", entityId: loan.id, docType: "ADVANCE_PROOF", filename: f.name, fileData: Buffer.from(await f.arrayBuffer()), mimeType: f.type, branchId: loan.branchId, uploadedById: user.id } });
  }
  await logAudit({ entityType: "EMPLOYEE_LOAN", entityId: loan.id, action: "UPDATE", before: { givenDate: null }, after: { givenDate: day, method, reference, attachments: files.length || undefined, ref: advanceRef(loan.refNo), employee: loan.employee.name }, userId: user.id, userName: user.name, branchId: loan.branchId });
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

// ------------------------------------------------------- choosing the months later, and from the payroll run

/** Reads the plan fields of the form (the same ones the new-advance form sends) into a stored plan. */
function planFromForm(formData: FormData, principal: number) {
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
  return buildRecoveryPlan(
    mode === "CUSTOM" ? { mode: "CUSTOM", principal, rows }
    : mode === "EQUAL" ? { mode: "EQUAL", principal, startMonth: str(formData.get("startMonth")), instalment: money(formData.get("instalment")) }
    : { mode: "ONE_MONTH", principal, month: str(formData.get("month")) }
  );
}

/** Sets which month(s) an advance is deducted in, for one approved without a plan or one nothing has been recovered from yet. */
export async function setLoanPlanAction(_prev: State, formData: FormData): Promise<State> {
  await requireWrite("payroll.payroll");
  { const invalid = contactsError(formData); if (invalid) return { error: invalid }; }
  await requirePermission("payroll.payroll", "edit");
  const { user, branchId, isSuperAdmin } = await requireUserWithBranch();
  const loan = await loanInBranch(str(formData.get("id")), branchId, isSuperAdmin);
  if (!loan) return { error: "Advance not found." };
  if (loan.status !== "ACTIVE" || loan.approvalStatus === "REJECTED") return { error: "That advance is no longer active." };
  if (Number(loan.repaid) > 0) return { error: "Something has already been recovered from it, so its months can't be changed." };
  const plan = planFromForm(formData, Number(loan.principal));
  if ("error" in plan) return { error: plan.error };
  await prisma.employeeLoan.update({ where: { id: loan.id }, data: { startMonth: plan.startMonth, instalment: plan.instalment, schedule: plan.schedule ?? Prisma.DbNull, planPending: false } });
  await logAudit({ entityType: "EMPLOYEE_LOAN", entityId: loan.id, action: "UPDATE", before: { startMonth: loan.startMonth, planPending: loan.planPending }, after: { startMonth: plan.startMonth, instalment: plan.instalment, planned: !!plan.schedule, ref: advanceRef(loan.refNo), employee: loan.employee.name }, userId: user.id, userName: user.name, branchId: loan.branchId });
  revalidatePath("/payroll/loans");
  revalidatePath("/payroll");
  return { error: null, ok: true };
}

export type RunAdvance = { id: string; ref: string; type: string; principal: number; repaid: number; balance: number; givenDate: string; planPending: boolean; planned: number; plan: string };

async function runForAdvances(runId: string, branchId: string | null, isSuperAdmin: boolean) {
  const run = await prisma.payrollRun.findUnique({ where: { id: runId }, select: { id: true, month: true, status: true, submittedAt: true, branchId: true, companyId: true, payType: true } });
  return run && !isOutsideBranch(run.branchId, branchId, isSuperAdmin) ? run : null;
}

/** The advances one worker still owes, with what this run's month is set to take from each (for the Advances popup on a payroll run). */
export async function loadRunAdvancesAction(runId: string, employeeId: string): Promise<{ error?: string; month?: string; canApply?: boolean; advances?: RunAdvance[] }> {
  await requireView("payroll.payroll");
  const { branchId, isSuperAdmin } = await requireUserWithBranch();
  const run = await runForAdvances(runId, branchId, isSuperAdmin);
  if (!run) return { error: "Run not found." };
  const loans = await prisma.employeeLoan.findMany({ where: { employeeId, branchId: run.branchId, status: "ACTIVE", approvalStatus: "APPROVED", givenDate: { not: null } }, orderBy: { createdAt: "asc" } });
  const advances: RunAdvance[] = loans
    .map((l) => {
      const principal = Number(l.principal), repaid = Number(l.repaid);
      const schedule = readSchedule(l.schedule);
      const rows = planRows({ principal, instalment: Number(l.instalment), startMonth: l.startMonth, schedule });
      return {
        id: l.id, ref: advanceRef(l.refNo), type: l.type, principal, repaid, balance: Math.round((principal - repaid) * 100) / 100, givenDate: l.givenDate!.toISOString().slice(0, 10), planPending: l.planPending,
        planned: l.planPending || l.startMonth > run.month ? 0 : Math.min(Math.round((principal - repaid) * 100) / 100, loanInstalmentFor({ instalment: Number(l.instalment), schedule }, run.month)),
        plan: l.planPending ? "Months not chosen yet" : rows.length === 1 ? `AED ${rows[0].amount.toFixed(2)} in ${rows[0].month}` : `${rows.length} months from ${rows[0]?.month ?? l.startMonth}`,
      };
    })
    .filter((a) => a.balance > 0);
  return { month: run.month, canApply: run.status === "DRAFT" && !run.submittedAt, advances };
}

/**
 * Sets what this run's month takes from each of a worker's advances, then works their line out again. An advance
 * with no months chosen gets its plan from this; it keeps deducting that amount in later months until it is cleared
 * unless the plan is changed.
 */
export async function applyRunAdvancesAction(runId: string, employeeId: string, entries: { loanId: string; amount: number }[]): Promise<{ error?: string }> {
  await requireWrite("payroll.payroll");
  await requirePermission("payroll.payroll", "edit");
  const { user, branchId, isSuperAdmin } = await requireUserWithBranch();
  const run = await runForAdvances(runId, branchId, isSuperAdmin);
  if (!run) return { error: "Run not found." };
  if (run.status !== "DRAFT" || run.submittedAt) return { error: "This run can't be changed any more." };
  const loans = await prisma.employeeLoan.findMany({ where: { employeeId, branchId: run.branchId, status: "ACTIVE", approvalStatus: "APPROVED", givenDate: { not: null }, id: { in: entries.map((e) => e.loanId) } } });
  const changed: string[] = [];
  for (const e of entries) {
    const loan = loans.find((l) => l.id === e.loanId);
    if (!loan) return { error: "One of those advances isn't open any more." };
    const amount = Math.round(Number(e.amount) * 100) / 100;
    const balance = Math.round((Number(loan.principal) - Number(loan.repaid)) * 100) / 100;
    if (!Number.isFinite(amount) || amount < 0) return { error: "Enter an amount of zero or more." };
    if (amount > balance) return { error: `${advanceRef(loan.refNo)}: AED ${amount.toFixed(2)} is more than the AED ${balance.toFixed(2)} still owed.` };
    const next = withMonthAmount({ principal: Number(loan.principal), instalment: Number(loan.instalment), startMonth: loan.startMonth, schedule: readSchedule(loan.schedule), planPending: loan.planPending }, run.month, amount);
    await prisma.employeeLoan.update({ where: { id: loan.id }, data: { startMonth: next.startMonth, instalment: next.instalment, schedule: next.schedule, planPending: false } });
    await logAudit({ entityType: "EMPLOYEE_LOAN", entityId: loan.id, action: "UPDATE", after: { month: run.month, deduct: amount, ref: advanceRef(loan.refNo), via: "payroll run" }, userId: user.id, userName: user.name, branchId: loan.branchId });
    changed.push(loan.id);
  }
  // The line takes the loans' plan again (a typed advance on the line is replaced by this).
  await prisma.payrollLine.updateMany({ where: { runId: run.id, employeeId }, data: { advanceManual: false } });
  await rebuildRunLines(run);
  revalidatePath(`/payroll/${run.id}`);
  revalidatePath("/payroll/loans");
  return {};
}
