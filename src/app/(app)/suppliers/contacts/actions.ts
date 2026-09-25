"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requirePermission, requireUserWithBranch } from "@/lib/auth";
import { isOutsideBranch } from "@/lib/branch";
import { logAudit } from "@/lib/audit";

type State = { error: string | null; ok?: boolean };
const str = (v: FormDataEntryValue | null) => String(v ?? "").trim();

export async function addContactAction(_prev: State, formData: FormData): Promise<State> {
  await requirePermission("partners", "edit");
  const { user, branchId } = await requireUserWithBranch();
  if (!branchId) return { error: "Pick a branch from the switcher first." };
  const department = str(formData.get("department"));
  const personName = str(formData.get("personName"));
  const email = str(formData.get("email"));
  if (!department || !personName) return { error: "Enter the department and the person's name." };
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: "Enter a valid email address." };
  if (!str(formData.get("phone")) && !email) return { error: "Add a phone number or an email so suppliers can reach them." };
  const c = await prisma.portalContact.create({ data: { branchId, department, personName, designation: str(formData.get("designation")) || null, phone: str(formData.get("phone")) || null, email: email || null, sortOrder: Math.trunc(Number(str(formData.get("sortOrder")) || 0)) || 0 } });
  await logAudit({ entityType: "PORTAL_CONTACT", entityId: c.id, action: "CREATE", after: { department, personName }, userId: user.id, userName: user.name, branchId });
  revalidatePath("/suppliers/contacts");
  return { error: null, ok: true };
}

export async function toggleContactAction(formData: FormData): Promise<State> {
  await requirePermission("partners", "edit");
  const { branchId, isSuperAdmin } = await requireUserWithBranch();
  const c = await prisma.portalContact.findUnique({ where: { id: str(formData.get("id")) } });
  if (!c || isOutsideBranch(c.branchId, branchId, isSuperAdmin)) return { error: "Not found." };
  await prisma.portalContact.update({ where: { id: c.id }, data: { isActive: !c.isActive } });
  revalidatePath("/suppliers/contacts");
  return { error: null, ok: true };
}

export async function deleteContactAction(formData: FormData): Promise<State> {
  await requirePermission("partners", "delete");
  const { user, branchId, isSuperAdmin } = await requireUserWithBranch();
  const c = await prisma.portalContact.findUnique({ where: { id: str(formData.get("id")) } });
  if (!c || isOutsideBranch(c.branchId, branchId, isSuperAdmin)) return { error: "Not found." };
  await prisma.portalContact.delete({ where: { id: c.id } });
  await logAudit({ entityType: "PORTAL_CONTACT", entityId: c.id, action: "DELETE", before: { department: c.department, personName: c.personName }, userId: user.id, userName: user.name, branchId: c.branchId });
  revalidatePath("/suppliers/contacts");
  return { error: null, ok: true };
}
