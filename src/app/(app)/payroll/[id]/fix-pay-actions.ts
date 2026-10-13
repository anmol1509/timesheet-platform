"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requirePermission, requireUserWithBranch, requireWrite } from "@/lib/auth";
import { isOutsideBranch } from "@/lib/branch";
import { logAudit } from "@/lib/audit";
import { payColumns, payFieldsFor, payInputFromRate, payRevision, structuresFor } from "@/lib/payFields";
import { rebuildRunLines, runSkipped } from "@/lib/payrollRun";

export type FixPayEntry = {
  employeeId: string;
  structure: "FLAT" | "ITEMISED" | "HOURLY";
  rate: number | null;
  housing?: number | null; food?: number | null; transport?: number | null; other?: number | null;
};
export type FixPayResult = { error: string | null; fixed: number; failed: { employeeId: string; message: string }[] };

const MAX_ENTRIES = 300;

async function loadDraftRun(runId: string) {
  const { user, branchId, isSuperAdmin } = await requireUserWithBranch();
  const run = await prisma.payrollRun.findUnique({ where: { id: runId } });
  if (!run || isOutsideBranch(run.branchId, branchId, isSuperAdmin)) return { user, run: null, error: "Run not found." };
  if (run.status !== "DRAFT") return { user, run: null, error: "Pay can only be fixed on a draft run. Reopen the run first." };
  return { user, run, error: null };
}

const toNumbers = (v: unknown) => (v == null ? null : Number(String(v)));

/**
 * Sets how workers are paid straight from the run they were left out of. Only workers the run itself reports as skipped for
 * missing pay can be changed here. Each change is recorded in pay history and the audit log, then the run is recalculated once
 * so they move into it.
 */
export async function setPayFromRunAction(runId: string, entries: FixPayEntry[]): Promise<FixPayResult> {
  await requireWrite("payroll.payroll");
  await requirePermission("payroll.payroll", "edit");
  const { user, run, error } = await loadDraftRun(runId);
  if (!run) return { error, fixed: 0, failed: [] };
  if (entries.length === 0) return { error: "Choose at least one worker.", fixed: 0, failed: [] };
  if (entries.length > MAX_ENTRIES) return { error: `Set pay for at most ${MAX_ENTRIES} workers at a time.`, fixed: 0, failed: [] };

  const skipped = await runSkipped(run);
  const fixable = new Set(skipped.filter((s) => s.kind === "PAY").map((s) => s.id));
  const failed: FixPayResult["failed"] = [];
  let fixed = 0;

  for (const entry of entries) {
    if (!fixable.has(entry.employeeId)) { failed.push({ employeeId: entry.employeeId, message: "This worker isn't waiting on pay set-up in this run." }); continue; }
    if (!structuresFor(run.payType).includes(entry.structure)) { failed.push({ employeeId: entry.employeeId, message: run.payType === "HOURLY" ? "This company pays by the hour, so choose Hourly." : "This company pays a monthly salary, so choose Flat or Itemised." }); continue; }
    const pay = payFieldsFor(payInputFromRate(entry.structure, entry.rate, { housing: entry.housing, food: entry.food, transport: entry.transport, other: entry.other }));
    if ("error" in pay) { failed.push({ employeeId: entry.employeeId, message: pay.error }); continue; }

    const before = await prisma.employee.findUnique({ where: { id: entry.employeeId }, select: { id: true, branchId: true, payStructure: true, basicSalary: true, housingAllowance: true, foodAllowance: true, transportAllowance: true, otherAllowance: true, flatMonthlyRate: true, hourlyRate: true } });
    if (!before || before.branchId !== run.branchId) { failed.push({ employeeId: entry.employeeId, message: "Worker not found." }); continue; }
    const columns = payColumns(pay.fields);
    await prisma.employee.update({ where: { id: before.id }, data: { ...columns, payOverride: true } });
    const revision = payRevision(before, columns);
    if (revision) {
      await prisma.salaryRevision.create({
        data: { employeeId: before.id, branchId: before.branchId, effectiveFrom: new Date(), reason: `Pay set from payroll run ${run.month}`, before: revision.before, after: revision.after, fixedBefore: revision.fixedBefore, fixedAfter: revision.fixedAfter, createdById: user.id, createdByName: user.name },
      });
    }
    await logAudit({
      entityType: "EMPLOYEE", entityId: before.id, action: "UPDATE",
      before: Object.fromEntries(Object.keys(columns).map((k) => [k, k === "payStructure" ? before.payStructure : toNumbers((before as Record<string, unknown>)[k])])),
      after: columns, userId: user.id, userName: user.name, branchId: run.branchId,
    });
    fixed++;
  }

  if (fixed > 0) {
    const { count, skipped: still } = await rebuildRunLines(run);
    await prisma.payrollRunEvent.create({ data: { runId: run.id, action: "RECALCULATED", note: `Pay set for ${fixed} worker${fixed === 1 ? "" : "s"} from the run (${count} now in the run${still.length ? `, ${still.length} still left out` : ""})`, userId: user.id, userName: user.name } });
  }
  revalidatePath(`/payroll/${run.id}`);
  revalidatePath("/payroll");
  return { error: null, fixed, failed };
}

/** For a worker marked inactive with no last working day: bring them back as active, or give the day they left so their final month is paid. */
export async function fixInactiveFromRunAction(runId: string, employeeId: string, mode: "ACTIVE" | "EXIT", exitDate: string | null): Promise<{ error: string | null }> {
  await requireWrite("payroll.payroll");
  await requirePermission("payroll.payroll", "edit");
  const { user, run, error } = await loadDraftRun(runId);
  if (!run) return { error };
  const skipped = await runSkipped(run);
  if (!skipped.some((s) => s.id === employeeId && s.kind === "INACTIVE")) return { error: "This worker isn't waiting on a last working day in this run." };

  const emp = await prisma.employee.findUnique({ where: { id: employeeId }, select: { id: true, branchId: true, joinDate: true } });
  if (!emp || emp.branchId !== run.branchId) return { error: "Worker not found." };

  let data: { active?: boolean; exitDate: Date | null; inactiveReason?: string | null };
  if (mode === "ACTIVE") {
    data = { active: true, exitDate: null, inactiveReason: null };
  } else {
    const d = exitDate ? new Date(exitDate) : null;
    if (!d || Number.isNaN(d.getTime())) return { error: "Enter their last working day." };
    if (emp.joinDate && d < emp.joinDate) return { error: "The last working day can't be before the join date." };
    data = { exitDate: d };
  }
  await prisma.employee.update({ where: { id: employeeId }, data });
  await logAudit({ entityType: "EMPLOYEE", entityId: employeeId, action: "UPDATE", before: { active: false, exitDate: null }, after: mode === "ACTIVE" ? { active: true } : { exitDate: data.exitDate }, userId: user.id, userName: user.name, branchId: run.branchId });
  const { count } = await rebuildRunLines(run);
  await prisma.payrollRunEvent.create({ data: { runId: run.id, action: "RECALCULATED", note: `${mode === "ACTIVE" ? "Marked active" : "Last working day set"} from the run (${count} now in the run)`, userId: user.id, userName: user.name } });
  revalidatePath(`/payroll/${run.id}`);
  return { error: null };
}
