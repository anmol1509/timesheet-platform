"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireUserWithBranch, requirePermission } from "@/lib/auth";
import { isOutsideBranch } from "@/lib/branch";
import { logAudit } from "@/lib/audit";
import { isPayType, monthBounds, round2, wpsGaps } from "@/lib/payroll";
import { isUsableBank } from "@/lib/bankStatus";
import { approverIds, notifyUsers } from "@/lib/notifications/notify";
import { rebuildRunLines, recordLoanRepayments, reverseLoanRepayments } from "@/lib/payrollRun";
import { assertContactsValid } from "@/lib/validators";

type State = { error: string | null; ok?: boolean };

/** Appends to the run's sign-off trail. */
async function trail(runId: string, action: string, user: { id: string; name: string }, note?: string | null) {
  await prisma.payrollRunEvent.create({ data: { runId, action, note: note ?? null, userId: user.id, userName: user.name } });
}

async function loadRun(id: string) {
  const { user, branchId, isSuperAdmin } = await requireUserWithBranch();
  const run = await prisma.payrollRun.findUnique({ where: { id }, include: { lines: { include: { employee: { select: { name: true } } } } } });
  if (!run || isOutsideBranch(run.branchId, branchId, isSuperAdmin)) return { user, run: null };
  return { user, run };
}

export async function createRunAction(_prev: State, formData: FormData): Promise<State> {
  assertContactsValid(formData);
  await requirePermission("payroll", "create");
  const { user, branchId } = await requireUserWithBranch();
  if (!branchId) return { error: "Pick a branch from the switcher first." };
  const month = String(formData.get("month") || "");
  if (!monthBounds(month)) return { error: "Choose a month." };

  // Payroll is only for our own companies' employees, one run per company.
  const companyId = String(formData.get("companyId") || "");
  const company = companyId ? await prisma.supplier.findFirst({ where: { id: companyId, branchId, isOwnCompany: true }, select: { id: true, name: true, payType: true, wpsEstablishmentId: true } }) : null;
  if (!company) return { error: "Choose which of your companies this payroll is for." };
  if (!isPayType(company.payType)) return { error: `Set how ${company.name} pays its people (Basic or Hourly) on its company page first.` };
  if (await prisma.payrollRun.count({ where: { branchId, companyId: company.id, month } }) > 0) return { error: `A payroll run for ${company.name} in ${month} already exists.` };

  // Pay from the company's own account if it has a usable one; otherwise the branch default.
  const banks = await prisma.bank.findMany({ where: { branchId, companyId: company.id, status: "ACTIVE" }, orderBy: { accountName: "asc" } });
  const bank = banks.find((b) => isUsableBank(b) && b.routingCode) ?? null;
  const branch = await prisma.branch.findUnique({ where: { id: branchId }, select: { wpsPayerBankId: true } });

  let created;
  try {
    created = await prisma.payrollRun.create({
      data: { month, branchId, companyId: company.id, payType: company.payType, createdById: user.id, payerBankId: bank?.id ?? branch?.wpsPayerBankId ?? null },
    });
  } catch {
    return { error: `A payroll run for ${company.name} in ${month} already exists.` };
  }
  const { count, skipped } = await rebuildRunLines(created);
  await trail(created.id, "CREATED", user, skipped.length > 0 ? `${skipped.length} employee${skipped.length === 1 ? "" : "s"} skipped: missing pay details` : null);
  await logAudit({ entityType: "PAYROLL_RUN", entityId: created.id, action: "CREATE", after: { month, company: company.name, payType: company.payType, employees: count, skipped: skipped.length }, userId: user.id, userName: user.name, branchId });
  revalidatePath("/payroll");
  redirect(`/payroll/${created.id}`);
}

export async function recomputeRunAction(formData: FormData): Promise<State> {
  assertContactsValid(formData);
  await requirePermission("payroll", "edit");
  const { user, run } = await loadRun(String(formData.get("id") || ""));
  if (!run) return { error: "Run not found." };
  if (run.status !== "DRAFT") return { error: "Only a draft run can be recalculated. Reopen it first." };
  const { count, skipped } = await rebuildRunLines(run);
  await trail(run.id, "RECALCULATED", user, skipped.length > 0 ? `${skipped.length} skipped: missing pay details` : null);
  await logAudit({ entityType: "PAYROLL_RUN", entityId: run.id, action: "UPDATE", before: { lines: run.lines.length }, after: { recomputed: count }, userId: user.id, userName: user.name, branchId: run.branchId });
  revalidatePath(`/payroll/${run.id}`);
  return { error: null, ok: true };
}

/**
 * Saves what was typed against one line: a deduction, the advance recovered and
 * an adjustment, each with its own note. Net pay is recomputed from the stored
 * components, and the typed amounts can't push it below zero.
 */
export async function saveLineAction(formData: FormData): Promise<State> {
  assertContactsValid(formData);
  await requirePermission("payroll", "edit");
  const lineId = String(formData.get("lineId") || "");
  const line = await prisma.payrollLine.findUnique({ where: { id: lineId }, include: { employee: { select: { name: true } } } });
  if (!line) return { error: "Line not found." };
  const { user, run } = await loadRun(line.runId);
  if (!run) return { error: "Run not found." };
  if (run.status !== "DRAFT") return { error: "Approved runs are locked." };

  const amount = (k: string) => { const raw = String(formData.get(k) || "0").trim(); return round2(Number(raw === "" ? 0 : raw)); };
  const note = (k: string) => String(formData.get(k) || "").trim().slice(0, 200) || null;
  const deduction = amount("deduction");
  const advance = amount("advance");
  const adjustment = amount("adjustment");
  if (![deduction, advance, adjustment].every(Number.isFinite) || Math.abs(adjustment) > 1_000_000 || deduction < 0 || advance < 0 || deduction > 1_000_000 || advance > 1_000_000) {
    return { error: "Enter valid amounts. Deduction and advance can't be negative." };
  }
  if (deduction > 0 && !note("deductionNote")) return { error: "Add a note saying what the deduction is for." };
  if (advance > 0 && !note("advanceNote")) return { error: "Add a note for the advance." };

  const n = (d: { toString(): string }) => Number(d.toString());
  const base = n(line.basic) + n(line.allowances) - n(line.deductions) + n(line.overtimePay) + adjustment + n(line.otherEarnings) - n(line.otherDeductions);
  if (round2(base - deduction - advance) < 0) {
    return { error: `Deduction plus advance (AED ${round2(deduction + advance).toFixed(2)}) is more than the pay available (AED ${round2(Math.max(0, base)).toFixed(2)}).` };
  }
  const net = round2(base - deduction - advance);
  await prisma.payrollLine.update({
    where: { id: lineId },
    data: { adjustment, adjustmentNote: note("adjustmentNote"), manualDeduction: deduction, deductionNote: deduction > 0 ? note("deductionNote") : null, loanDeduction: advance, advanceNote: advance > 0 ? note("advanceNote") : null, advanceManual: true, net },
  });
  await logAudit({
    entityType: "PAYROLL_LINE", entityId: lineId, action: "UPDATE",
    before: { adjustment: n(line.adjustment), deduction: n(line.manualDeduction), advance: n(line.loanDeduction) },
    after: { adjustment, deduction, advance, deductionNote: note("deductionNote"), advanceNote: note("advanceNote"), employee: line.employee.name },
    userId: user.id, userName: user.name, branchId: run.branchId,
  });
  revalidatePath(`/payroll/${run.id}`);
  return { error: null, ok: true };
}

/** The creator sends a finished draft for approval; it then appears in the Approvals inbox. */
export async function submitRunAction(formData: FormData): Promise<State> {
  assertContactsValid(formData);
  await requirePermission("payroll", "edit");
  const { user, run } = await loadRun(String(formData.get("id") || ""));
  if (!run) return { error: "Run not found." };
  if (run.status !== "DRAFT") return { error: "Only a draft can be sent for approval." };
  if (run.submittedAt) return { error: "It has already been sent for approval." };
  if (run.lines.length === 0) return { error: "There are no employees in this run yet." };
  await prisma.payrollRun.update({ where: { id: run.id }, data: { submittedAt: new Date(), submittedById: user.id, returnNote: null } });
  await trail(run.id, "SUBMITTED", user);
  await notifyUsers({
    userIds: (await approverIds("payroll", run.branchId)).filter((id) => id !== user.id),
    kind: "PAYROLL_SUBMITTED",
    title: `Payroll to approve: ${run.month}`,
    body: `${user.name} sent a payroll run for approval.`,
    href: "/approvals?type=PAYROLL",
  });
  await logAudit({ entityType: "PAYROLL_RUN", entityId: run.id, action: "UPDATE", before: { submitted: false }, after: { submitted: true, month: run.month }, userId: user.id, userName: user.name, branchId: run.branchId });
  revalidatePath(`/payroll/${run.id}`);
  revalidatePath("/payroll");
  revalidatePath("/approvals");
  return { error: null, ok: true };
}

/** An approver sends a submitted run back to its creator, with the reason. */
export async function returnRunAction(formData: FormData): Promise<State> {
  assertContactsValid(formData);
  await requirePermission("payroll", "approve");
  const { user, run } = await loadRun(String(formData.get("id") || ""));
  if (!run) return { error: "Run not found." };
  if (run.status !== "DRAFT" || !run.submittedAt) return { error: "That run isn't waiting for approval." };
  const note = String(formData.get("note") || "").trim();
  if (!note) return { error: "Say what needs fixing, so it can be corrected." };
  await prisma.payrollRun.update({ where: { id: run.id }, data: { submittedAt: null, submittedById: null, returnNote: note } });
  await trail(run.id, "RETURNED", user, note);
  if (run.submittedById) await notifyUsers({ userIds: [run.submittedById].filter((id) => id !== user.id), kind: "PAYROLL_RETURNED", title: `Payroll ${run.month} was sent back`, body: note, href: `/payroll/${run.id}` });
  await logAudit({ entityType: "PAYROLL_RUN", entityId: run.id, action: "UPDATE", before: { submitted: true }, after: { submitted: false, returned: note }, userId: user.id, userName: user.name, branchId: run.branchId });
  revalidatePath(`/payroll/${run.id}`);
  revalidatePath("/payroll");
  revalidatePath("/approvals");
  return { error: null, ok: true };
}

export async function approveRunAction(formData: FormData): Promise<State> {
  assertContactsValid(formData);
  await requirePermission("payroll", "approve");
  const { user, run } = await loadRun(String(formData.get("id") || ""));
  if (!run) return { error: "Run not found." };
  if (run.status !== "DRAFT") return { error: "Already approved." };
  if (!run.submittedAt) return { error: "The run must be sent for approval first (Submit for approval on the run)." };
  if (run.lines.length === 0) return { error: "There are no employees with a pay structure to pay." };

  // Four-eyes rule: above the branch's threshold, the run's creator can't be
  // the one who approves it.
  const rule = await prisma.branch.findUnique({ where: { id: run.branchId }, select: { payrollApprovalThreshold: true } });
  const threshold = rule?.payrollApprovalThreshold ? Number(rule.payrollApprovalThreshold) : null;
  const runTotal = round2(run.lines.reduce((s, l) => s + Number(l.net), 0));
  if (threshold !== null && runTotal > threshold && run.createdById === user.id) {
    return { error: `This run is AED ${runTotal.toLocaleString("en-AE", { minimumFractionDigits: 2 })}, over the AED ${threshold.toLocaleString("en-AE")} limit, so someone other than its creator has to approve it.` };
  }

  const blocked = run.lines
    .map((l) => ({ name: l.employee.name, gaps: wpsGaps(l) }))
    .filter((x) => x.gaps.length > 0);
  if (blocked.length > 0) {
    const list = blocked.slice(0, 4).map((b) => `${b.name} (${b.gaps.join(", ")})`).join("; ");
    return { error: `Missing bank details for ${blocked.length} employee${blocked.length === 1 ? "" : "s"}: ${list}${blocked.length > 4 ? "…" : ""}. Fix them on the employee's Payroll & WPS tab, then Recalculate.` };
  }

  await prisma.payrollRun.update({ where: { id: run.id }, data: { status: "APPROVED", approvedAt: new Date(), approvedById: user.id } });
  await recordLoanRepayments(run);
  await trail(run.id, "APPROVED", user);
  await logAudit({ entityType: "PAYROLL_RUN", entityId: run.id, action: "UPDATE", before: { status: "DRAFT" }, after: { status: "APPROVED", total: round2(run.lines.reduce((s, l) => s + Number(l.net), 0)) }, userId: user.id, userName: user.name, branchId: run.branchId });
  revalidatePath(`/payroll/${run.id}`);
  revalidatePath("/payroll");
  revalidatePath("/approvals");
  return { error: null, ok: true };
}

export async function reopenRunAction(formData: FormData): Promise<State> {
  assertContactsValid(formData);
  await requirePermission("payroll", "approve");
  const { user, run } = await loadRun(String(formData.get("id") || ""));
  if (!run) return { error: "Run not found." };
  if (run.status !== "APPROVED") return { error: "Only an approved (unpaid) run can be reopened." };
  await reverseLoanRepayments(run.id);
  await prisma.payrollRun.update({ where: { id: run.id }, data: { status: "DRAFT", approvedAt: null, approvedById: null, submittedAt: null, submittedById: null } });
  await trail(run.id, "REOPENED", user);
  await logAudit({ entityType: "PAYROLL_RUN", entityId: run.id, action: "UPDATE", before: { status: "APPROVED" }, after: { status: "DRAFT" }, userId: user.id, userName: user.name, branchId: run.branchId });
  revalidatePath(`/payroll/${run.id}`);
  revalidatePath("/payroll");
  return { error: null, ok: true };
}

export async function markPaidAction(formData: FormData): Promise<State> {
  assertContactsValid(formData);
  await requirePermission("payroll", "approve");
  const { user, run } = await loadRun(String(formData.get("id") || ""));
  if (!run) return { error: "Run not found." };
  if (run.status !== "APPROVED") return { error: "Approve the run before marking it paid." };
  await prisma.payrollRun.update({ where: { id: run.id }, data: { status: "PAID", paidAt: new Date() } });
  // Whatever the bank hasn't bounced is now paid; rejected and resubmitted lines stay flagged.
  await prisma.payrollLine.updateMany({ where: { runId: run.id, paymentStatus: "PENDING" }, data: { paymentStatus: "PAID" } });
  await trail(run.id, "PAID", user);
  await logAudit({ entityType: "PAYROLL_RUN", entityId: run.id, action: "UPDATE", before: { status: "APPROVED" }, after: { status: "PAID" }, userId: user.id, userName: user.name, branchId: run.branchId });
  revalidatePath(`/payroll/${run.id}`);
  revalidatePath("/payroll");
  return { error: null, ok: true };
}

export async function deleteRunAction(formData: FormData) {
  assertContactsValid(formData);
  await requirePermission("payroll", "delete");
  const { user, run } = await loadRun(String(formData.get("id") || ""));
  if (!run || run.status !== "DRAFT") return;
  await prisma.payrollRun.delete({ where: { id: run.id } });
  await logAudit({ entityType: "PAYROLL_RUN", entityId: run.id, action: "DELETE", before: { month: run.month, lines: run.lines.length }, userId: user.id, userName: user.name, branchId: run.branchId });
  revalidatePath("/payroll");
  redirect("/payroll");
}

const PAYMENT_STATUSES = ["PENDING", "PAID", "REJECTED", "RESUBMIT"] as const;

/** Record what the bank did with one worker's salary after the WPS file went out. */
export async function setLinePaymentAction(formData: FormData): Promise<State> {
  assertContactsValid(formData);
  await requirePermission("payroll", "approve");
  const lineId = String(formData.get("lineId") || "");
  const status = String(formData.get("status") || "");
  const note = String(formData.get("note") || "").trim() || null;
  if (!PAYMENT_STATUSES.includes(status as (typeof PAYMENT_STATUSES)[number])) return { error: "Choose a status." };
  const line = await prisma.payrollLine.findUnique({ where: { id: lineId }, include: { employee: { select: { name: true } } } });
  if (!line) return { error: "Line not found." };
  const { user, run } = await loadRun(line.runId);
  if (!run) return { error: "Run not found." };
  if (run.status === "DRAFT") return { error: "Approve the run before recording payments." };
  if (status === "REJECTED" && !note) return { error: "Say why the bank rejected it, so it can be fixed." };

  await prisma.payrollLine.update({ where: { id: lineId }, data: { paymentStatus: status, paymentNote: status === "PAID" ? null : note } });
  await logAudit({ entityType: "PAYROLL_LINE", entityId: lineId, action: "UPDATE", before: { paymentStatus: line.paymentStatus, note: line.paymentNote }, after: { paymentStatus: status, note, employee: line.employee.name }, userId: user.id, userName: user.name, branchId: run.branchId });
  revalidatePath(`/payroll/${run.id}`);
  return { error: null, ok: true };
}

/** Copy the employee's current bank details onto a rejected line so it can be re-sent. */
export async function refreshLineBankAction(formData: FormData): Promise<State> {
  assertContactsValid(formData);
  await requirePermission("payroll", "approve");
  const lineId = String(formData.get("lineId") || "");
  const line = await prisma.payrollLine.findUnique({ where: { id: lineId }, include: { employee: { select: { name: true, molPersonCode: true, wpsPaymentMode: true, wpsBankName: true, wpsRoutingCode: true, wpsIban: true, wpsAccountNumber: true } } } });
  if (!line) return { error: "Line not found." };
  const { user, run } = await loadRun(line.runId);
  if (!run) return { error: "Run not found." };
  if (run.status === "DRAFT") return { error: "Recalculate the draft instead." };
  if (line.paymentStatus !== "REJECTED") return { error: "Only a rejected line can be refreshed." };

  const e = line.employee;
  const next = { paymentMode: e.wpsPaymentMode, personCode: e.molPersonCode, bankName: e.wpsBankName, routingCode: e.wpsRoutingCode, account: e.wpsIban || e.wpsAccountNumber };
  const gaps = wpsGaps(next);
  if (gaps.length > 0) return { error: `${e.name} still has no ${gaps.join(", ")}. Fix it on the employee's Payroll & WPS tab first.` };
  await prisma.payrollLine.update({ where: { id: lineId }, data: { ...next, paymentStatus: "RESUBMIT" } });
  await logAudit({ entityType: "PAYROLL_LINE", entityId: lineId, action: "UPDATE", before: { bank: line.bankName, account: line.account }, after: { bank: next.bankName, account: next.account, employee: e.name, refreshed: true }, userId: user.id, userName: user.name, branchId: run.branchId });
  revalidatePath(`/payroll/${run.id}`);
  return { error: null, ok: true };
}

/** Set (or clear) the run total above which the creator may not approve their own run. */
export async function setApprovalThresholdAction(formData: FormData): Promise<State> {
  assertContactsValid(formData);
  await requirePermission("payroll", "approve");
  const { user, branchId } = await requireUserWithBranch();
  if (!branchId) return { error: "Pick a branch from the switcher first." };
  const raw = String(formData.get("threshold") || "").trim();
  const value = raw === "" ? null : round2(Number(raw));
  if (value !== null && (!Number.isFinite(value) || value < 0)) return { error: "Enter an amount, or leave it blank for no limit." };
  const before = await prisma.branch.findUnique({ where: { id: branchId }, select: { payrollApprovalThreshold: true } });
  await prisma.branch.update({ where: { id: branchId }, data: { payrollApprovalThreshold: value } });
  await logAudit({ entityType: "BRANCH", entityId: branchId, action: "UPDATE", before: { payrollApprovalThreshold: before?.payrollApprovalThreshold ? Number(before.payrollApprovalThreshold) : null }, after: { payrollApprovalThreshold: value }, userId: user.id, userName: user.name, branchId });
  revalidatePath("/payroll");
  return { error: null, ok: true };
}
