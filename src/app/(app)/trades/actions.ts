"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireUserWithBranch, requirePermission } from "@/lib/auth";
import { findVisibleSkill, mayEditSkill } from "@/lib/skillScope";
import { logAudit } from "@/lib/audit";
import { assertContactsValid } from "@/lib/validators";

/** Rejects the accidental one- and two-character entries ("car", "y"). */
const MIN_SKILL_NAME = 3;

export async function createSkillAction(formData: FormData) {
  assertContactsValid(formData);
  const { user, branchId, isSuperAdmin } = await requireUserWithBranch();
  const name = String(formData.get("name") || "").trim().replace(/\s+/g, " ");
  if (name.length < MIN_SKILL_NAME) return;
  const category = String(formData.get("category") || "").trim() || null;
  const trending = formData.get("trending") === "on";

  const existing = await findVisibleSkill(name, branchId);

  // A match found case-insensitively is updated rather than duplicated — but only
  // if it is the caller's to change. A client re-adding a shared trade such as
  // "Mason" must not rewrite the shared row every other client reads.
  if (existing) {
    if (!mayEditSkill(existing, { branchId, isSuperAdmin })) return;
    await prisma.skill.update({ where: { id: existing.id }, data: { category, trending } });
    await logAudit({
      entityType: "SKILL",
      entityId: existing.id,
      action: "UPDATE",
      before: existing as unknown as Record<string, unknown>,
      after: { category, trending },
      userId: user.id,
      userName: user.name,
      branchId: existing.branchId,
    });
  } else {
    // Owned by the branch that added it (shared when a super admin has no branch selected).
    const created = await prisma.skill.create({ data: { name, category, trending, branchId } });
    await logAudit({
      entityType: "SKILL",
      entityId: created.id,
      action: "CREATE",
      after: { name, category, trending },
      userId: user.id,
      userName: user.name,
      branchId,
    });
  }

  revalidatePath("/skills");
}

export async function updateSkillAction(formData: FormData) {
  assertContactsValid(formData);
  const { user, branchId, isSuperAdmin } = await requireUserWithBranch();
  const id = String(formData.get("skillId") || "");
  const name = String(formData.get("name") || "").trim();
  if (!id || !name) return;
  const category = String(formData.get("category") || "").trim() || null;

  const before = await prisma.skill.findUnique({ where: { id } });
  if (!before || !mayEditSkill(before, { branchId, isSuperAdmin })) return;
  // A rename must not collide with another trade the branch can see.
  const clash = await findVisibleSkill(name, before.branchId);
  if (clash && clash.id !== id) return;
  await prisma.skill.update({ where: { id }, data: { name, category } });

  await logAudit({
    entityType: "SKILL",
    entityId: id,
    action: "UPDATE",
    before: before as unknown as Record<string, unknown>,
    after: { name, category },
    userId: user.id,
    userName: user.name,
    branchId: before.branchId,
  });

  revalidatePath("/skills");
}

export async function toggleTrendingAction(formData: FormData) {
  assertContactsValid(formData);
  const { user, branchId, isSuperAdmin } = await requireUserWithBranch();
  const id = String(formData.get("skillId") || "");
  const trending = formData.get("trending") === "true";
  if (!id) return;
  const target = await prisma.skill.findUnique({ where: { id }, select: { branchId: true } });
  if (!target || !mayEditSkill(target, { branchId, isSuperAdmin })) return;

  await prisma.skill.update({ where: { id }, data: { trending: !trending } });

  await logAudit({
    entityType: "SKILL",
    entityId: id,
    action: "UPDATE",
    before: { trending },
    after: { trending: !trending },
    userId: user.id,
    userName: user.name,
    branchId: target.branchId,
  });

  revalidatePath("/skills");
}

export async function deleteSkillAction(formData: FormData) {
  assertContactsValid(formData);
  await requirePermission("workforce", "delete");
  const { user, branchId, isSuperAdmin } = await requireUserWithBranch();
  const id = String(formData.get("skillId") || "");
  if (!id) return;

  const existing = await prisma.skill.findUnique({ where: { id } });
  // Deleting a shared trade would strip it from every client's workers.
  if (!existing || !mayEditSkill(existing, { branchId, isSuperAdmin })) return;
  // Deleting cascades to every EmployeeSkill row, stripping the skill from
  // workers who have it — recorded here so the audit trail shows the scope.
  const holders = await prisma.employeeSkill.count({ where: { skillId: id } });
  await prisma.skill.delete({ where: { id } });

  if (existing) {
    await logAudit({
      entityType: "SKILL",
      entityId: id,
      action: "DELETE",
      before: { ...(existing as unknown as Record<string, unknown>), employeesHolding: holders },
      userId: user.id,
      userName: user.name,
      branchId: existing.branchId,
    });
  }

  revalidatePath("/skills");
}
