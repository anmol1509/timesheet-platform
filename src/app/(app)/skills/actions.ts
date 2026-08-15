"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { logAudit } from "@/lib/audit";

/**
 * Finds an existing skill regardless of casing or spacing.
 *
 * `Skill.name` is uniquely indexed on the exact string, so "Carpentry",
 * "carpentry" and "carpenter " each used to become a separate skill — which
 * quietly breaks the one thing skills are for, matching workers to a trade.
 * The stored spelling of the first one wins; later spellings fold into it.
 */
async function findSkillByName(name: string) {
  return prisma.skill.findFirst({
    where: { name: { equals: name, mode: "insensitive" } },
  });
}

/** Rejects the accidental one- and two-character entries ("car", "y"). */
const MIN_SKILL_NAME = 3;

export async function createSkillAction(formData: FormData) {
  const user = await requireUser();
  const name = String(formData.get("name") || "").trim().replace(/\s+/g, " ");
  if (name.length < MIN_SKILL_NAME) return;
  const category = String(formData.get("category") || "").trim() || null;
  const trending = formData.get("trending") === "on";

  const existing = await findSkillByName(name);

  // Update the match found case-insensitively rather than creating a twin.
  const skill = existing
    ? await prisma.skill.update({
        where: { id: existing.id },
        data: { category, trending },
      })
    : await prisma.skill.create({ data: { name, category, trending } });

  if (existing) {
    await logAudit({
      entityType: "SKILL",
      entityId: skill.id,
      action: "UPDATE",
      before: existing as unknown as Record<string, unknown>,
      after: { category, trending },
      userId: user.id,
      userName: user.name,
      branchId: null,
    });
  } else {
    await logAudit({
      entityType: "SKILL",
      entityId: skill.id,
      action: "CREATE",
      after: { name, category, trending },
      userId: user.id,
      userName: user.name,
      branchId: null,
    });
  }

  revalidatePath("/skills");
}

export async function updateSkillAction(formData: FormData) {
  const user = await requireUser();
  const id = String(formData.get("skillId") || "");
  const name = String(formData.get("name") || "").trim();
  if (!id || !name) return;
  const category = String(formData.get("category") || "").trim() || null;

  const before = await prisma.skill.findUnique({ where: { id } });
  await prisma.skill.update({ where: { id }, data: { name, category } });

  await logAudit({
    entityType: "SKILL",
    entityId: id,
    action: "UPDATE",
    before: before as unknown as Record<string, unknown>,
    after: { name, category },
    userId: user.id,
    userName: user.name,
    branchId: null,
  });

  revalidatePath("/skills");
}

export async function toggleTrendingAction(formData: FormData) {
  const user = await requireUser();
  const id = String(formData.get("skillId") || "");
  const trending = formData.get("trending") === "true";
  if (!id) return;

  await prisma.skill.update({ where: { id }, data: { trending: !trending } });

  await logAudit({
    entityType: "SKILL",
    entityId: id,
    action: "UPDATE",
    before: { trending },
    after: { trending: !trending },
    userId: user.id,
    userName: user.name,
    branchId: null,
  });

  revalidatePath("/skills");
}

export async function deleteSkillAction(formData: FormData) {
  const user = await requireUser();
  const id = String(formData.get("skillId") || "");
  if (!id) return;

  const existing = await prisma.skill.findUnique({ where: { id } });
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
      branchId: null,
    });
  }

  revalidatePath("/skills");
}
