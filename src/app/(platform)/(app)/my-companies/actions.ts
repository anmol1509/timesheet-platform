"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireUserWithBranch, subjectOf } from "@/lib/auth";
import { canMyCompanies } from "@/lib/permissions";
import { findSupplierByName, uniqueSupplierCode } from "@/lib/entityCode";
import { logAudit } from "@/lib/audit";

/** Adds one of your own companies. It is an ordinary supplier row marked as an own company, so payroll, letters, banks and the rest see it as before. */
export async function createOwnCompanyAction(formData: FormData): Promise<{ error: string }> {
  const { user, branchId } = await requireUserWithBranch();
  if (!canMyCompanies(subjectOf(user), "create")) return { error: "You don't have permission to add a company." };
  if (!branchId) return { error: "Pick a branch from the switcher first." };
  const name = String(formData.get("name") || "").trim();
  const fullName = String(formData.get("fullName") || "").trim() || null;
  if (!name) return { error: "Enter the company name." };
  if (await findSupplierByName(name, branchId)) return { error: "A company or supplier with that name already exists." };
  const code = await uniqueSupplierCode(name, branchId);
  const created = await prisma.supplier.create({ data: { name, code, fullName, branchId, isOwnCompany: true } });
  await logAudit({ entityType: "SUPPLIER", entityId: created.id, action: "CREATE", after: { name, code, fullName, isOwnCompany: true }, userId: user.id, userName: user.name, branchId });
  revalidatePath("/my-companies");
  revalidatePath("/suppliers");
  redirect(`/suppliers/${created.id}`);
}
