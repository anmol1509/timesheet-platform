"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireUserWithBranch } from "@/lib/auth";
import { isOutsideBranch } from "@/lib/branch";
import { logAudit } from "@/lib/audit";
import { LOOKUP_CATEGORIES } from "@/lib/lookupCategories";

async function assertLookupInBranch(id: string, branchId: string | null, isSuperAdmin: boolean) {
  const row = await prisma.lookupValue.findUnique({
    where: { id },
    select: { branchId: true, isActive: true },
  });
  return row && !isOutsideBranch(row.branchId, branchId, isSuperAdmin) ? row : null;
}

export async function createLookupValueAction(formData: FormData) {
  const { user, branchId } = await requireUserWithBranch();
  const category = String(formData.get("category") || "");
  const value = String(formData.get("value") || "").trim();
  if (!branchId || !value || !LOOKUP_CATEGORIES.some((c) => c.key === category)) return;

  const created = await prisma.lookupValue.create({
    data: { branchId, category, value },
  });

  await logAudit({
    entityType: "LOOKUP_VALUE",
    entityId: created.id,
    action: "CREATE",
    after: { category, value, isActive: true },
    userId: user.id,
    userName: user.name,
    branchId,
  });

  revalidatePath("/lookups");
}

export async function toggleLookupValueActiveAction(formData: FormData) {
  const { user, branchId, isSuperAdmin } = await requireUserWithBranch();
  const id = String(formData.get("lookupValueId") || "");
  if (!id) return;
  const existing = await assertLookupInBranch(id, branchId, isSuperAdmin);
  if (!existing) return;

  const updated = await prisma.lookupValue.update({
    where: { id },
    data: { isActive: !existing.isActive },
  });

  await logAudit({
    entityType: "LOOKUP_VALUE",
    entityId: id,
    action: "UPDATE",
    before: { isActive: existing.isActive },
    after: { isActive: updated.isActive },
    userId: user.id,
    userName: user.name,
    branchId: updated.branchId,
  });

  revalidatePath("/lookups");
}
