"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";

export async function createSkillAction(formData: FormData) {
  await requireUser();
  const name = String(formData.get("name") || "").trim();
  if (!name) return;
  const category = String(formData.get("category") || "").trim() || null;
  const trending = formData.get("trending") === "on";

  await prisma.skill.upsert({
    where: { name },
    update: { category, trending },
    create: { name, category, trending },
  });

  revalidatePath("/skills");
}

export async function toggleTrendingAction(formData: FormData) {
  await requireUser();
  const id = String(formData.get("skillId") || "");
  const trending = formData.get("trending") === "true";
  if (!id) return;
  await prisma.skill.update({ where: { id }, data: { trending: !trending } });
  revalidatePath("/skills");
}
