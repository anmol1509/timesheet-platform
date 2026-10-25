"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireUserWithBranch, requireWrite } from "@/lib/auth";
import { isOutsideBranch } from "@/lib/branch";
import { logAudit } from "@/lib/audit";

type Result = { error: string | null; ok?: boolean };

/** Marks a supplier that already exists as a recruitment agency, so it is offered when adding candidates. Own companies can't be agencies. */
export async function addExistingAsAgencyAction(_prev: Result, formData: FormData): Promise<Result> {
  await requireWrite("onboarding.tracker");
  const { user, branchId, isSuperAdmin } = await requireUserWithBranch();
  const id = String(formData.get("supplierId") || "");
  if (!id) return { error: "Choose a supplier." };
  const s = await prisma.supplier.findUnique({ where: { id }, select: { id: true, name: true, branchId: true, isOwnCompany: true, isRecruitmentAgency: true, category: true } });
  if (!s || isOutsideBranch(s.branchId, branchId, isSuperAdmin)) return { error: "That supplier wasn't found." };
  if (s.isOwnCompany) return { error: "One of your own companies can't be a recruitment agency." };
  if (s.isRecruitmentAgency) return { error: "It is already a recruitment agency." };
  await prisma.supplier.update({ where: { id }, data: { isRecruitmentAgency: true, category: s.category ?? "Recruitment agency" } });
  await logAudit({ entityType: "SUPPLIER", entityId: id, action: "UPDATE", before: { recruitmentAgency: false }, after: { recruitmentAgency: true }, userId: user.id, userName: user.name, branchId: s.branchId });
  revalidatePath("/onboarding/agencies");
  revalidatePath("/onboarding");
  return { error: null, ok: true };
}

/** Stops treating a supplier as an agency. Refused while candidates came through it, so their history keeps its source. */
export async function removeAgencyFlagAction(formData: FormData): Promise<void> {
  await requireWrite("onboarding.tracker");
  const { user, branchId, isSuperAdmin } = await requireUserWithBranch();
  const id = String(formData.get("supplierId") || "");
  const s = await prisma.supplier.findUnique({ where: { id }, select: { branchId: true, isRecruitmentAgency: true, _count: { select: { candidateOnboardings: true } } } });
  if (!s || !s.isRecruitmentAgency || isOutsideBranch(s.branchId, branchId, isSuperAdmin) || s._count.candidateOnboardings > 0) return;
  await prisma.supplier.update({ where: { id }, data: { isRecruitmentAgency: false } });
  await logAudit({ entityType: "SUPPLIER", entityId: id, action: "UPDATE", before: { recruitmentAgency: true }, after: { recruitmentAgency: false }, userId: user.id, userName: user.name, branchId: s.branchId });
  revalidatePath("/onboarding/agencies");
}
