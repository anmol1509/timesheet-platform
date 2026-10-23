"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { can } from "@/lib/permissions";
import { requireUserWithBranch, subjectOf } from "@/lib/auth";
import { isOutsideBranch } from "@/lib/branch";
import { logAudit } from "@/lib/audit";
import { PARTY_ROLES } from "@/lib/documentTypes";

const ROLES = new Set<string>(PARTY_ROLES.map((r) => r.value));
const clean = (v: FormDataEntryValue | null) => String(v ?? "").trim() || null;

async function guard(supplierId: string) {
  const ctx = await requireUserWithBranch();
  if (!can(subjectOf(ctx.user), "partners.suppliers", "edit")) return { error: "You don't have permission to edit suppliers." } as const;
  const supplier = await prisma.supplier.findUnique({ where: { id: supplierId }, select: { id: true, branchId: true } });
  if (!supplier || isOutsideBranch(supplier.branchId, ctx.branchId, ctx.isSuperAdmin)) return { error: "That supplier wasn't found." } as const;
  return { ctx, supplier } as const;
}

export async function addSupplierPartyAction(formData: FormData): Promise<{ error?: string }> {
  const supplierId = String(formData.get("supplierId") || "");
  const g = await guard(supplierId);
  if ("error" in g) return { error: g.error };
  const role = String(formData.get("role") || "");
  const name = String(formData.get("name") || "").trim();
  if (!ROLES.has(role)) return { error: "Choose a role." };
  if (!name) return { error: "Enter a name." };
  if (!g.supplier.branchId) return { error: "This supplier has no branch." };
  const party = await prisma.supplierParty.create({
    data: { supplierId, branchId: g.supplier.branchId, role, name, nationality: clean(formData.get("nationality")), phone: clean(formData.get("phone")), email: clean(formData.get("email")), notes: clean(formData.get("notes")) },
  });
  await logAudit({ entityType: "SUPPLIER_PARTY", entityId: party.id, action: "CREATE", after: { supplierId, role, name }, userId: g.ctx.user.id, userName: g.ctx.user.name, branchId: g.supplier.branchId });
  revalidatePath(`/suppliers/${supplierId}`);
  return {};
}

export async function deleteSupplierPartyAction(formData: FormData): Promise<void> {
  const id = String(formData.get("partyId") || "");
  const party = await prisma.supplierParty.findUnique({ where: { id }, select: { id: true, supplierId: true, role: true, name: true, branchId: true } });
  if (!party) return;
  const g = await guard(party.supplierId);
  if ("error" in g) return;
  // Their files hang off the party by id, with no foreign key, so remove them with it.
  await prisma.$transaction([
    prisma.attachment.deleteMany({ where: { entityType: "SUPPLIER_PARTY", entityId: party.id } }),
    prisma.supplierParty.delete({ where: { id: party.id } }),
  ]);
  await logAudit({ entityType: "SUPPLIER_PARTY", entityId: party.id, action: "DELETE", before: { role: party.role, name: party.name }, userId: g.ctx.user.id, userName: g.ctx.user.name, branchId: party.branchId });
  revalidatePath(`/suppliers/${party.supplierId}`);
}
