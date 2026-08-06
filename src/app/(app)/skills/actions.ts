"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { logAudit } from "@/lib/audit";

export async function createSkillAction(formData: FormData) {
  const user = await requireUser();
  const name = String(formData.get("name") || "").trim();
  if (!name) return;
  const category = String(formData.get("category") || "").trim() || null;
  const trending = formData.get("trending") === "on";

  const existing = await prisma.skill.findUnique({ where: { name } });

  const skill = await prisma.skill.upsert({
    where: { name },
    update: { category, trending },
    create: { name, category, trending },
  });

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
  await prisma.skill.delete({ where: { id } });

  if (existing) {
    await logAudit({
      entityType: "SKILL",
      entityId: id,
      action: "DELETE",
      before: existing as unknown as Record<string, unknown>,
      userId: user.id,
      userName: user.name,
      branchId: null,
    });
  }

  revalidatePath("/skills");
}
