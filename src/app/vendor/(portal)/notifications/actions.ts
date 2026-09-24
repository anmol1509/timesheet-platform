"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { getVendor } from "@/lib/vendor/session";

export async function markAllReadAction() {
  const vendor = await getVendor();
  if (!vendor) return;
  await prisma.supplierNotification.updateMany({ where: { supplierId: vendor.id, readAt: null }, data: { readAt: new Date() } });
  revalidatePath("/vendor", "layout");
}
