"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";

export async function deleteUploadAction(formData: FormData) {
  await requireAdmin();
  const uploadId = String(formData.get("uploadId") || "");
  if (!uploadId) return;

  const upload = await prisma.upload.findUnique({
    where: { id: uploadId },
    include: { months: true },
  });
  if (!upload) return;

  const months = upload.months.map((m) => m.month);
  if (months.length > 0) {
    await prisma.timesheetEntry.deleteMany({ where: { month: { in: months } } });
  }
  await prisma.upload.delete({ where: { id: uploadId } });

  revalidatePath("/upload");
  revalidatePath("/companies");
  revalidatePath("/");
}
