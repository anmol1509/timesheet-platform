"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireUserWithBranch, requirePermission, requireWrite } from "@/lib/auth";
import { isOutsideBranch } from "@/lib/branch";
import { logAudit } from "@/lib/audit";
import { parseHidden } from "@/lib/payslipView";

/** Keeps the chosen payslip lines off every payslip from now on (the company's default). */
export async function savePayslipDefaultAction(runId: string, hidden: string[]): Promise<{ error: string | null }> {
  await requireWrite("payroll.payroll");
  await requirePermission("payroll.payroll", "edit");
  const { user, branchId, isSuperAdmin } = await requireUserWithBranch();
  const run = await prisma.payrollRun.findUnique({ where: { id: runId }, select: { branchId: true } });
  if (!run || isOutsideBranch(run.branchId, branchId, isSuperAdmin)) return { error: "Run not found." };
  const next = parseHidden(Array.isArray(hidden) ? hidden.join(",") : "");
  const before = await prisma.branch.findUnique({ where: { id: run.branchId }, select: { payslipHidden: true } });
  await prisma.branch.update({ where: { id: run.branchId }, data: { payslipHidden: next.join(",") } });
  await logAudit({ entityType: "BRANCH", entityId: run.branchId, action: "UPDATE", before: { payslipHidden: before?.payslipHidden ?? "" }, after: { payslipHidden: next.join(",") }, userId: user.id, userName: user.name, branchId: run.branchId });
  revalidatePath(`/payroll/${runId}/payslips`);
  return { error: null };
}
