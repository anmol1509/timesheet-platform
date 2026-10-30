"use server";

import { revalidatePath } from "next/cache";
import { requireUserWithBranch, subjectOf } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { applyRevert, previewRevert } from "@/lib/auditRevert";

export type RevertPreview =
  | { error: string }
  | { title: string; problem?: string; fields: { key: string; label: string; now: string; back: string; status: "ok" | "changed" | "skipped"; reason?: string }[] };

async function who() {
  const { user, branchId } = await requireUserWithBranch();
  return { id: user.id, name: user.name, role: user.role, permissions: subjectOf(user).permissions, branchId, canSeePay: can(subjectOf(user), "payroll", "view") };
}

/** What would go back, for the confirmation window. Changes nothing. */
export async function previewRevertAction(entryId: string): Promise<RevertPreview> {
  const r = await previewRevert(entryId, await who());
  if ("error" in r) return r;
  return { title: r.title, problem: r.plan.problem, fields: r.plan.fields.map(({ key, label, now, back, status, reason }) => ({ key, label, now, back, status, reason })) };
}

export async function revertAuditEntryAction(entryId: string): Promise<{ ok: true; restored: number; skipped: number } | { ok: false; error: string }> {
  const r = await applyRevert(entryId, await who());
  if (r.ok) revalidatePath("/audit-log");
  return r;
}
