"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireUserWithBranch, subjectOf } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { isOutsideBranch } from "@/lib/branch";
import { logAudit } from "@/lib/audit";
import { ABSCOND_CASE_STATUSES, type AbscondCaseStatus } from "@/lib/absconding";

type Result = { ok: true } | { error: string };

async function load(id: string) {
  const { user, branchId, isSuperAdmin } = await requireUserWithBranch();
  if (!can(subjectOf(user), "workforce", "edit")) return { error: "You don't have permission to edit employees." } as const;
  const e = await prisma.employee.findUnique({ where: { id }, select: { id: true, name: true, branchId: true, status: true, abscondedAt: true, abscondRemarks: true, abscondCaseStatus: true } });
  if (!e || isOutsideBranch(e.branchId, branchId, isSuperAdmin)) return { error: "That employee isn't in this company." } as const;
  return { user, branchId, e } as const;
}

function parseDate(s: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Marks a worker as absconding, or updates the open case. */
export async function saveAbscondingAction(input: { id: string; date: string; remarks: string; caseStatus: string }): Promise<Result> {
  const ctx = await load(input.id);
  if ("error" in ctx && ctx.error) return { error: ctx.error };
  const date = parseDate(input.date.trim());
  if (!date) return { error: "Enter the date they absconded." };
  if (date.getTime() > Date.now() + 86_400_000) return { error: "The absconding date can't be in the future." };
  if (!(ABSCOND_CASE_STATUSES as readonly string[]).includes(input.caseStatus)) return { error: "Choose the case status." };
  const remarks = input.remarks.trim().slice(0, 1000) || null;
  const { e, user, branchId } = ctx as Exclude<typeof ctx, { error: string }>;
  // A closed or returned case is over: the worker is not absconding any more.
  const stillAbsconding = input.caseStatus === "Reported" || input.caseStatus === "Under investigation";
  const status = stillAbsconding ? "ABSCONDING" : e.status === "ABSCONDING" ? "IDLE" : e.status;
  await prisma.employee.update({
    where: { id: e.id },
    data: { status, abscondedAt: date, abscondRemarks: remarks, abscondCaseStatus: input.caseStatus },
  });
  await logAudit({
    entityType: "EMPLOYEE",
    entityId: e.id,
    action: "UPDATE",
    before: { status: e.status, abscondedAt: e.abscondedAt, abscondRemarks: e.abscondRemarks, abscondCaseStatus: e.abscondCaseStatus },
    after: { status, abscondedAt: date, abscondRemarks: remarks, abscondCaseStatus: input.caseStatus as AbscondCaseStatus },
    userId: user.id,
    userName: user.name,
    branchId,
  });
  revalidatePath(`/employees/${e.id}`);
  revalidatePath("/employees");
  return { ok: true };
}
