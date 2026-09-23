"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireUserWithBranch, requirePermission } from "@/lib/auth";
import { isOutsideBranch } from "@/lib/branch";
import { logAudit } from "@/lib/audit";
import { monthBounds, round2, wpsGaps } from "@/lib/payroll";
import { rebuildRunLines } from "@/lib/payrollRun";

type State = { error: string | null; ok?: boolean };

async function loadRun(id: string) {
  const { user, branchId, isSuperAdmin } = await requireUserWithBranch();
  const run = await prisma.payrollRun.findUnique({ where: { id }, include: { lines: { include: { employee: { select: { name: true } } } } } });
  if (!run || isOutsideBranch(run.branchId, branchId, isSuperAdmin)) return { user, run: null };
  return { user, run };
}

export async function createRunAction(_prev: State, formData: FormData): Promise<State> {
  await requirePermission("payroll", "create");
  const { user, branchId } = await requireUserWithBranch();
  if (!branchId) return { error: "Pick a branch from the switcher first." };
  const month = String(formData.get("month") || "");
  if (!monthBounds(month)) return { error: "Choose a month." };

  const branch = await prisma.branch.findUnique({ where: { id: branchId }, select: { wpsPayerBankId: true } });
  let created;
  try {
    created = await prisma.payrollRun.create({
      data: { month, branchId, createdById: user.id, payerBankId: branch?.wpsPayerBankId ?? null },
    });
  } catch {
    return { error: `A payroll run for ${month} already exists.` };
  }
  const { count } = await rebuildRunLines(created);
  await logAudit({ entityType: "PAYROLL_RUN", entityId: created.id, action: "CREATE", after: { month, employees: count }, userId: user.id, userName: user.name, branchId });
  revalidatePath("/payroll");
  redirect(`/payroll/${created.id}`);
}

export async function recomputeRunAction(formData: FormData): Promise<State> {
  await requirePermission("payroll", "edit");
  const { user, run } = await loadRun(String(formData.get("id") || ""));
  if (!run) return { error: "Run not found." };
  if (run.status !== "DRAFT") return { error: "Only a draft run can be recalculated. Reopen it first." };
  const { count } = await rebuildRunLines(run);
  await logAudit({ entityType: "PAYROLL_RUN", entityId: run.id, action: "UPDATE", before: { lines: run.lines.length }, after: { recomputed: count }, userId: user.id, userName: user.name, branchId: run.branchId });
  revalidatePath(`/payroll/${run.id}`);
  return { error: null, ok: true };
}

export async function saveAdjustmentAction(formData: FormData): Promise<State> {
  await requirePermission("payroll", "edit");
  const lineId = String(formData.get("lineId") || "");
  const line = await prisma.payrollLine.findUnique({ where: { id: lineId }, select: { runId: true } });
  if (!line) return { error: "Line not found." };
  const { user, run } = await loadRun(line.runId);
  if (!run) return { error: "Run not found." };
  if (run.status !== "DRAFT") return { error: "Approved runs are locked." };

  const raw = String(formData.get("adjustment") || "0").trim();
  const adjustment = round2(Number(raw === "" ? 0 : raw));
  if (!Number.isFinite(adjustment) || Math.abs(adjustment) > 1_000_000) return { error: "Enter a valid amount (negative to deduct)." };
  const note = String(formData.get("note") || "").trim() || null;

  const l = run.lines.find((x) => x.id === lineId)!;
  const net = round2(Number(l.basic) + Number(l.allowances) - Number(l.deductions) + Number(l.overtimePay) + adjustment);
  if (net < 0) return { error: "That adjustment would make net pay negative." };
  await prisma.payrollLine.update({ where: { id: lineId }, data: { adjustment, adjustmentNote: note, net } });
  await logAudit({
    entityType: "PAYROLL_LINE",
    entityId: lineId,
    action: "UPDATE",
    before: { adjustment: Number(l.adjustment), note: l.adjustmentNote },
    after: { adjustment, note, employee: l.employee.name },
    userId: user.id,
    userName: user.name,
    branchId: run.branchId,
  });
  revalidatePath(`/payroll/${run.id}`);
  return { error: null, ok: true };
}

export async function approveRunAction(formData: FormData): Promise<State> {
  await requirePermission("payroll", "approve");
  const { user, run } = await loadRun(String(formData.get("id") || ""));
  if (!run) return { error: "Run not found." };
  if (run.status !== "DRAFT") return { error: "Already approved." };
  if (run.lines.length === 0) return { error: "There are no employees with a pay structure to pay." };

  const blocked = run.lines
    .map((l) => ({ name: l.employee.name, gaps: wpsGaps(l) }))
    .filter((x) => x.gaps.length > 0);
  if (blocked.length > 0) {
    const list = blocked.slice(0, 4).map((b) => `${b.name} (${b.gaps.join(", ")})`).join("; ");
    return { error: `Missing bank details for ${blocked.length} employee${blocked.length === 1 ? "" : "s"}: ${list}${blocked.length > 4 ? "…" : ""}. Fix them on the employee's Payroll & WPS tab, then Recalculate.` };
  }

  await prisma.payrollRun.update({ where: { id: run.id }, data: { status: "APPROVED", approvedAt: new Date(), approvedById: user.id } });
  await logAudit({ entityType: "PAYROLL_RUN", entityId: run.id, action: "UPDATE", before: { status: "DRAFT" }, after: { status: "APPROVED", total: round2(run.lines.reduce((s, l) => s + Number(l.net), 0)) }, userId: user.id, userName: user.name, branchId: run.branchId });
  revalidatePath(`/payroll/${run.id}`);
  revalidatePath("/payroll");
  return { error: null, ok: true };
}

export async function reopenRunAction(formData: FormData): Promise<State> {
  await requirePermission("payroll", "approve");
  const { user, run } = await loadRun(String(formData.get("id") || ""));
  if (!run) return { error: "Run not found." };
  if (run.status !== "APPROVED") return { error: "Only an approved (unpaid) run can be reopened." };
  await prisma.payrollRun.update({ where: { id: run.id }, data: { status: "DRAFT", approvedAt: null, approvedById: null } });
  await logAudit({ entityType: "PAYROLL_RUN", entityId: run.id, action: "UPDATE", before: { status: "APPROVED" }, after: { status: "DRAFT" }, userId: user.id, userName: user.name, branchId: run.branchId });
  revalidatePath(`/payroll/${run.id}`);
  revalidatePath("/payroll");
  return { error: null, ok: true };
}

export async function markPaidAction(formData: FormData): Promise<State> {
  await requirePermission("payroll", "approve");
  const { user, run } = await loadRun(String(formData.get("id") || ""));
  if (!run) return { error: "Run not found." };
  if (run.status !== "APPROVED") return { error: "Approve the run before marking it paid." };
  await prisma.payrollRun.update({ where: { id: run.id }, data: { status: "PAID", paidAt: new Date() } });
  await logAudit({ entityType: "PAYROLL_RUN", entityId: run.id, action: "UPDATE", before: { status: "APPROVED" }, after: { status: "PAID" }, userId: user.id, userName: user.name, branchId: run.branchId });
  revalidatePath(`/payroll/${run.id}`);
  revalidatePath("/payroll");
  return { error: null, ok: true };
}

export async function deleteRunAction(formData: FormData) {
  await requirePermission("payroll", "delete");
  const { user, run } = await loadRun(String(formData.get("id") || ""));
  if (!run || run.status !== "DRAFT") return;
  await prisma.payrollRun.delete({ where: { id: run.id } });
  await logAudit({ entityType: "PAYROLL_RUN", entityId: run.id, action: "DELETE", before: { month: run.month, lines: run.lines.length }, userId: user.id, userName: user.name, branchId: run.branchId });
  revalidatePath("/payroll");
  redirect("/payroll");
}
