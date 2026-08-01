"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

export async function markInvoicePaidAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) return;
  const invoiceId = String(formData.get("invoiceId") || "");
  if (!invoiceId) return;
  await prisma.clientInvoice.update({
    where: { id: invoiceId },
    data: { status: "PAID", paidDate: new Date() },
  });
  revalidatePath("/invoices/history");
}
