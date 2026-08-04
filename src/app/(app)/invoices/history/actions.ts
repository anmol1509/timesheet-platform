"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireUserWithBranch } from "@/lib/auth";
import { isOutsideBranch } from "@/lib/branch";

export async function markInvoicePaidAction(formData: FormData) {
  const { branchId, isSuperAdmin } = await requireUserWithBranch();
  const invoiceId = String(formData.get("invoiceId") || "");
  if (!invoiceId) return;

  const existing = await prisma.clientInvoice.findUnique({
    where: { id: invoiceId },
    select: { branchId: true },
  });
  if (!existing || isOutsideBranch(existing.branchId, branchId, isSuperAdmin)) return;

  await prisma.clientInvoice.update({
    where: { id: invoiceId },
    data: { status: "PAID", paidDate: new Date() },
  });
  revalidatePath("/invoices/history");
}
