"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireUserWithBranch } from "@/lib/auth";
import { isOutsideBranch } from "@/lib/branch";
import { logAudit } from "@/lib/audit";

export async function createLetterTemplateAction(formData: FormData) {
  const { user, branchId } = await requireUserWithBranch();
  const name = String(formData.get("name") || "").trim();
  const category = String(formData.get("category") || "").trim() || null;
  const remarksText = String(formData.get("remarksText") || "").trim();
  if (!branchId || !name || !remarksText) return;

  const created = await prisma.letterTemplate.create({
    data: { branchId, name, category, remarksText },
  });

  await logAudit({
    entityType: "LETTER_TEMPLATE",
    entityId: created.id,
    action: "CREATE",
    after: { name, category, remarksText },
    userId: user.id,
    userName: user.name,
    branchId,
  });

  revalidatePath("/letter-templates");
}

export async function deleteLetterTemplateAction(formData: FormData) {
  const { user, branchId, isSuperAdmin } = await requireUserWithBranch();
  const id = String(formData.get("letterTemplateId") || "");
  if (!id) return;

  const existing = await prisma.letterTemplate.findUnique({ where: { id } });
  if (!existing || isOutsideBranch(existing.branchId, branchId, isSuperAdmin)) return;

  const nocCount = await prisma.noc.count({ where: { templateId: id } });
  if (nocCount > 0) return;

  await prisma.letterTemplate.delete({ where: { id } });

  await logAudit({
    entityType: "LETTER_TEMPLATE",
    entityId: id,
    action: "DELETE",
    before: { name: existing.name, category: existing.category, remarksText: existing.remarksText },
    userId: user.id,
    userName: user.name,
    branchId: existing.branchId,
  });

  revalidatePath("/letter-templates");
}
