import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { entityMeta } from "@/lib/auditPresentation";

/**
 * Putting an edit back. Only plain data fields on the main records can be put back by machine: anything that
 * starts or stops other work (a status, a project, a company, an approval) has to be corrected by hand, because
 * writing the old value straight into the column would skip what the screen does around it.
 */

import { REVERTIBLE, planRevert, type FieldInfo, type RevertPlan } from "@/lib/auditRevertPlan";
export type { FieldInfo, FieldPlan, RevertPlan } from "@/lib/auditRevertPlan";

type Who = { id: string; name: string; role: string; permissions?: string[] | null; branchId: string | null; canSeePay: boolean };

function modelFields(modelName: string): Record<string, FieldInfo> | null {
  const dm = (prisma as unknown as { _runtimeDataModel?: { models: Record<string, { fields: FieldInfo[] }> } })._runtimeDataModel;
  const m = dm?.models?.[modelName];
  return m ? Object.fromEntries(m.fields.map((f) => [f.name, f])) : null;
}

type Loaded =
  | { error: string }
  | { entry: NonNullable<Awaited<ReturnType<typeof prisma.auditLog.findUnique>>>; target: { delegate: string; model: string }; fields: Record<string, FieldInfo>; current: Record<string, unknown> };

async function load(entryId: string, who: Who): Promise<Loaded> {
  if (who.role !== "SUPER_ADMIN" && who.role !== "BRANCH_ADMIN") return { error: "Only administrators can put changes back." };
  const entry = await prisma.auditLog.findUnique({ where: { id: entryId } });
  if (!entry) return { error: "That entry no longer exists." };
  if (who.branchId && entry.branchId !== who.branchId) return { error: "That entry belongs to another company." };
  if (entry.action !== "UPDATE") return { error: "Only edits can be put back. A record that was added or deleted has to be handled from its own screen." };
  if (entry.revertedAt) return { error: `Already put back by ${entry.revertedByName ?? "someone"}.` };
  const target = REVERTIBLE[entry.entityType];
  if (!target) return { error: `${entityMeta(entry.entityType).label} changes can't be put back automatically.` };
  const fields = modelFields(target.model);
  if (!fields) return { error: "Putting changes back isn't available right now." };
  const keys = Object.keys((entry.changes as Record<string, unknown> | null) ?? {}).filter((k) => fields[k]);
  const select = Object.fromEntries([...keys, ...(fields.branchId ? ["branchId"] : [])].map((k) => [k, true]));
  if (Object.keys(select).length === 0) return { error: "This entry has no field changes to put back." };
  const delegate = (prisma as unknown as Record<string, { findUnique: (a: unknown) => Promise<Record<string, unknown> | null> }>)[target.delegate];
  const current = await delegate.findUnique({ where: { id: entry.entityId }, select });
  if (!current) return { error: "That record no longer exists." };
  if (who.branchId && fields.branchId && current.branchId !== who.branchId) return { error: "That record belongs to another company." };
  return { entry, target, fields, current };
}

/** What would go back, for the confirmation dialog. Changes nothing. */
export async function previewRevert(entryId: string, who: Who): Promise<{ error: string } | { plan: RevertPlan; title: string }> {
  const l = await load(entryId, who);
  if ("error" in l) return l;
  const plan = planRevert(l.entry.changes as Record<string, unknown> | null, l.current, l.fields, { canSeePay: who.canSeePay });
  return { plan, title: entityMeta(l.entry.entityType).label };
}

export type RevertResult = { ok: true; restored: number; skipped: number } | { ok: false; error: string };

/** Puts back the fields that still hold what the edit wrote, and records that it did. */
export async function applyRevert(entryId: string, who: Who): Promise<RevertResult> {
  const l = await load(entryId, who);
  if ("error" in l) return { ok: false, error: l.error };
  const plan = planRevert(l.entry.changes as Record<string, unknown> | null, l.current, l.fields, { canSeePay: who.canSeePay });
  const ok = plan.fields.filter((f) => f.status === "ok");
  if (plan.problem || ok.length === 0) return { ok: false, error: plan.problem ?? "Nothing can be put back." };

  // Claim it first, so two people pressing the button together can't both write.
  const claim = await prisma.auditLog.updateMany({ where: { id: l.entry.id, revertedAt: null }, data: { revertedAt: new Date(), revertedByName: who.name } });
  if (claim.count === 0) return { ok: false, error: "Someone just put this back." };
  try {
    const delegate = (prisma as unknown as Record<string, { update: (a: unknown) => Promise<unknown> }>)[l.target.delegate];
    await delegate.update({ where: { id: l.entry.entityId }, data: Object.fromEntries(ok.map((f) => [f.key, f.value])) });
  } catch (e) {
    await prisma.auditLog.update({ where: { id: l.entry.id }, data: { revertedAt: null, revertedByName: null } }).catch(() => null);
    return { ok: false, error: e instanceof Error ? "It couldn't be saved: the record rejected the old value." : "It couldn't be saved." };
  }
  await logAudit({
    entityType: l.entry.entityType,
    entityId: l.entry.entityId,
    action: "UPDATE",
    before: Object.fromEntries(ok.map((f) => [f.key, l.current[f.key]])),
    after: Object.fromEntries(ok.map((f) => [f.key, f.value])),
    userId: who.id,
    userName: who.name,
    branchId: l.entry.branchId,
    source: "REVERT",
    revertOfId: l.entry.id,
  });
  return { ok: true, restored: ok.length, skipped: plan.fields.length - ok.length };
}
