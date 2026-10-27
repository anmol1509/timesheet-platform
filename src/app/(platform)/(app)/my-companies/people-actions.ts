"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { canMyCompanies, canViewSensitive } from "@/lib/permissions";
import { requireUserWithBranch, subjectOf } from "@/lib/auth";
import { isOutsideBranch } from "@/lib/branch";
import { logAudit } from "@/lib/audit";
import { OWNER_ROLE } from "@/lib/ownership";
import { sameName } from "@/lib/people";

/**
 * Merges a duplicate person into the one to keep: their company roles, shares and documents move across, details the kept
 * person lacks are filled in, and the duplicate is removed. Where both held the same role in a company the roles become
 * one (an owner's two shares are added). Needs My Companies edit and Sensitive documents, since personal documents move.
 */
export async function mergePeopleAction(input: { keepId: string; dropId: string }): Promise<{ error?: string }> {
  const ctx = await requireUserWithBranch();
  const subject = subjectOf(ctx.user);
  if (!canMyCompanies(subject, "edit") || !canViewSensitive(subject)) return { error: "Merging people needs My Companies edit access and the Sensitive documents permission." };
  const keepId = String(input?.keepId || "");
  const dropId = String(input?.dropId || "");
  if (!keepId || !dropId || keepId === dropId) return { error: "Choose two different people." };

  const [keep, drop] = await Promise.all([
    prisma.supplierParty.findUnique({ where: { id: keepId } }),
    prisma.supplierParty.findUnique({ where: { id: dropId } }),
  ]);
  if (!keep || !drop || isOutsideBranch(keep.branchId, ctx.branchId, ctx.isSuperAdmin) || isOutsideBranch(drop.branchId, ctx.branchId, ctx.isSuperAdmin)) return { error: "That person wasn't found." };
  if (keep.branchId !== drop.branchId) return { error: "These people belong to different companies." };
  if (!sameName(keep.name, drop.name)) return { error: "Only people with the same name can be merged." };

  await prisma.$transaction(async (tx) => {
    const keepLinks = await tx.supplierPartyLink.findMany({ where: { partyId: keep.id } });
    const dropLinks = await tx.supplierPartyLink.findMany({ where: { partyId: drop.id } });
    for (const l of dropLinks) {
      const twin = keepLinks.find((k) => k.supplierId === l.supplierId && k.role === l.role);
      if (!twin) { await tx.supplierPartyLink.update({ where: { id: l.id }, data: { partyId: keep.id } }); continue; }
      if (l.role === OWNER_ROLE && (l.ownershipPercent != null || twin.ownershipPercent != null)) {
        await tx.supplierPartyLink.update({ where: { id: twin.id }, data: { ownershipPercent: Math.min(100, (twin.ownershipPercent ?? 0) + (l.ownershipPercent ?? 0)) } });
      }
      await tx.supplierPartyLink.delete({ where: { id: l.id } });
    }
    await tx.attachment.updateMany({ where: { entityType: "SUPPLIER_PARTY", entityId: drop.id }, data: { entityId: keep.id } });
    await tx.supplierParty.update({
      where: { id: keep.id },
      data: { nationality: keep.nationality ?? drop.nationality, phone: keep.phone ?? drop.phone, email: keep.email ?? drop.email, notes: keep.notes ?? drop.notes },
    });
    await tx.supplierParty.delete({ where: { id: drop.id } });
  });
  await logAudit({ entityType: "SUPPLIER_PARTY", entityId: keep.id, action: "UPDATE", before: { merged: drop.name, duplicateId: drop.id }, after: { kept: keep.name }, userId: ctx.user.id, userName: ctx.user.name, branchId: keep.branchId });
  revalidatePath("/my-companies");
  revalidatePath("/suppliers");
  return {};
}
