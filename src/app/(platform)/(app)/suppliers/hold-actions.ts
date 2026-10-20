"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { can } from "@/lib/permissions";
import { requireUserWithBranch, subjectOf } from "@/lib/auth";
import { isOutsideBranch } from "@/lib/branch";
import { logAudit } from "@/lib/audit";
import { heldSuppliers } from "@/lib/supplierHold";

/** `detail` says what is outstanding, e.g. "Supplier approval: Pending · Labour approval: Pending". */
export type HeldRow = { id: string; name: string; workers: number; detail: string; needs: string[] };

/** Suppliers whose workers are held back, for the caller's branch, and whether the caller may approve them. */
export async function heldSuppliersAction(): Promise<{ rows: HeldRow[]; canApprove: boolean }> {
  const { user, branchId } = await requireUserWithBranch();
  const rows = await heldSuppliers(branchId);
  return {
    canApprove: can(subjectOf(user), "partners.suppliers", "approve"),
    rows: rows.map((h) => ({
      id: h.id,
      name: h.name,
      workers: h.workers,
      detail: `Supplier approval: ${h.approvalStatus} · Labour approval: ${h.labourApprovalStatus}`,
      needs: h.needs.map((n) => `Request #${n.requestNo} needs ${n.remaining} ${n.trade}`),
    })),
  };
}

/**
 * Approves a supplier for labour supply: the two flags that gate mobilising its workers, each only when it is
 * still Pending. A flag someone rejected is left alone and reported, since that was a decision, not an omission.
 */
export async function approveSupplierForLabourAction(supplierId: string): Promise<{ error?: string }> {
  const { user, branchId, isSuperAdmin } = await requireUserWithBranch();
  if (!can(subjectOf(user), "partners.suppliers", "approve")) return { error: "You don't have permission to approve suppliers." };
  const s = await prisma.supplier.findUnique({ where: { id: supplierId }, select: { id: true, name: true, branchId: true, approvalStatus: true, labourApprovalStatus: true } });
  if (!s || isOutsideBranch(s.branchId, branchId, isSuperAdmin)) return { error: "That supplier wasn't found." };

  const data: { approvalStatus?: string; labourApprovalStatus?: string } = {};
  if (s.approvalStatus === "Pending") data.approvalStatus = "Approved";
  if (s.labourApprovalStatus === "Pending") data.labourApprovalStatus = "Approved";
  if (Object.keys(data).length === 0) {
    const rejected = s.approvalStatus === "Rejected" || s.labourApprovalStatus === "Rejected";
    return rejected ? { error: `${s.name} was rejected. Reopen it from the supplier's page if that has changed.` } : {};
  }
  await prisma.supplier.update({ where: { id: s.id }, data });
  await logAudit({
    entityType: "SUPPLIER",
    entityId: s.id,
    action: "UPDATE",
    before: { approvalStatus: s.approvalStatus, labourApprovalStatus: s.labourApprovalStatus },
    after: data,
    userId: user.id,
    userName: user.name,
    branchId,
  });
  revalidatePath(`/suppliers/${s.id}`);
  revalidatePath("/suppliers");
  revalidatePath("/approvals");
  return {};
}
