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

// Lookup values are stored on records as plain strings, not foreign keys, so
// deleting one never breaks a row — it just stops being offered in dropdowns.
// The count is still worth showing: it's the difference between removing a
// typo nobody used and removing a value that 40 employees carry.
const LOOKUP_USAGE: Partial<
  Record<string, (value: string, branchId: string) => Promise<number>>
> = {
  TRADE: (value, branchId) =>
    prisma.employee.count({ where: { branchId, trade: value } }),
  POSITION: (value, branchId) =>
    prisma.employee.count({ where: { branchId, position: value } }),
  BLOOD_GROUP: (value, branchId) =>
    prisma.employee.count({ where: { branchId, bloodGroup: value } }),
  RELIGION: (value, branchId) =>
    prisma.employee.count({ where: { branchId, religion: value } }),
  ACCOMMODATION_TYPE: (value, branchId) =>
    prisma.employee.count({ where: { branchId, accommodationType: value } }),
  VISA_TYPE: (value, branchId) =>
    prisma.employee.count({ where: { branchId, visaType: value } }),
  VISA_STATUS: (value, branchId) =>
    prisma.employee.count({ where: { branchId, visaStatus: value } }),
};

/** How many records still carry a lookup value, for the confirm message. */
export async function countLookupValueUsageAction(id: string): Promise<number> {
  const { branchId, isSuperAdmin } = await requireUserWithBranch();
  const row = await prisma.lookupValue.findUnique({ where: { id } });
  if (!row || isOutsideBranch(row.branchId, branchId, isSuperAdmin)) return 0;

  const counter = LOOKUP_USAGE[row.category];
  return counter ? counter(row.value, row.branchId) : 0;
}

export async function deleteLookupValueAction(formData: FormData) {
  const { user, branchId, isSuperAdmin } = await requireUserWithBranch();
  const id = String(formData.get("lookupValueId") || "");
  if (!id) return;
  if (!(await assertLookupInBranch(id, branchId, isSuperAdmin))) return;

  const existing = await prisma.lookupValue.findUnique({ where: { id } });
  if (!existing) return;

  await prisma.lookupValue.delete({ where: { id } });

  await logAudit({
    entityType: "LOOKUP_VALUE",
    entityId: id,
    action: "DELETE",
    before: { category: existing.category, value: existing.value },
    userId: user.id,
    userName: user.name,
    branchId: existing.branchId,
  });

  revalidatePath("/lookups");
}
