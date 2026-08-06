"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireUserWithBranch } from "@/lib/auth";
import { isOutsideBranch } from "@/lib/branch";
import { logAudit } from "@/lib/audit";

export async function markInvoicePaidAction(formData: FormData) {
  const { user, branchId, isSuperAdmin } = await requireUserWithBranch();
  const invoiceId = String(formData.get("invoiceId") || "");
  if (!invoiceId) return;

  const existing = await prisma.clientInvoice.findUnique({
    where: { id: invoiceId },
  });
  if (!existing || isOutsideBranch(existing.branchId, branchId, isSuperAdmin)) return;

  const data = { status: "PAID", paidDate: new Date() };
  await prisma.clientInvoice.update({ where: { id: invoiceId }, data });

  await logAudit({
    entityType: "CLIENT_INVOICE",
    entityId: invoiceId,
    action: "UPDATE",
    before: existing as unknown as Record<string, unknown>,
    after: data,
    userId: user.id,
    userName: user.name,
    branchId,
  });

  revalidatePath("/invoices/history");
}
