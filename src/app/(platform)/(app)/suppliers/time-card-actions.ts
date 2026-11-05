"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireUserWithBranch, requirePermission, requireWrite } from "@/lib/auth";
import { isOutsideBranch } from "@/lib/branch";
import { logAudit } from "@/lib/audit";
import { Prisma } from "@/generated/prisma/client";
import { timeCardSpecFromForm } from "@/lib/timeCard";
import { assertContactsValid, contactsError } from "@/lib/validators";

type State = { error: string | null; ok?: boolean };

async function loadOwn(formData: FormData) {
  await requireWrite("partners.suppliers");
  await requirePermission("partners.suppliers", "edit");
  const { user, branchId, isSuperAdmin } = await requireUserWithBranch();
  const supplier = await prisma.supplier.findUnique({ where: { id: String(formData.get("supplierId") || "") }, select: { id: true, branchId: true, isOwnCompany: true, timeCardSpec: true } });
  if (!supplier || isOutsideBranch(supplier.branchId, branchId, isSuperAdmin)) return { user, supplier: null };
  return { user, supplier };
}

/** Saves one own company's own time card template, which replaces the shared one for its workers' cards. */
export async function saveCompanyTimeCardSpecAction(_prev: State, formData: FormData): Promise<State> {
  { const invalid = contactsError(formData); if (invalid) return { error: invalid }; }
  const { user, supplier } = await loadOwn(formData);
  if (!supplier || !supplier.isOwnCompany) return { error: "Company not found." };
  await prisma.supplier.update({ where: { id: supplier.id }, data: { timeCardSpec: timeCardSpecFromForm(formData) } });
  await logAudit({ entityType: "SUPPLIER", entityId: supplier.id, action: "UPDATE", before: { timeCard: supplier.timeCardSpec ? "(own template)" : "(shared template)" }, after: { timeCard: "(own template saved)" }, userId: user.id, userName: user.name, branchId: supplier.branchId });
  revalidatePath(`/suppliers/${supplier.id}`);
  revalidatePath("/settings/company");
  return { error: null, ok: true };
}

/** Back to the shared template. */
export async function resetCompanyTimeCardSpecAction(formData: FormData) {
  assertContactsValid(formData);
  const { user, supplier } = await loadOwn(formData);
  if (!supplier || !supplier.isOwnCompany) return { error: "Company not found." };
  await prisma.supplier.update({ where: { id: supplier.id }, data: { timeCardSpec: Prisma.DbNull } });
  await logAudit({ entityType: "SUPPLIER", entityId: supplier.id, action: "UPDATE", before: { timeCard: "(own template)" }, after: { timeCard: "(shared template)" }, userId: user.id, userName: user.name, branchId: supplier.branchId });
  revalidatePath(`/suppliers/${supplier.id}`);
  revalidatePath("/settings/company");
  return { error: null };
}
