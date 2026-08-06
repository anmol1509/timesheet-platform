"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireUserWithBranch } from "@/lib/auth";
import { isOutsideBranch } from "@/lib/branch";
import { logAudit } from "@/lib/audit";

export async function deleteUploadAction(formData: FormData) {
  const { user, branchId, isSuperAdmin } = await requireUserWithBranch();
  if (user.role !== "SUPER_ADMIN" && user.role !== "BRANCH_ADMIN") redirect("/");
  const uploadId = String(formData.get("uploadId") || "");
  if (!uploadId) return;

  const upload = await prisma.upload.findUnique({
    where: { id: uploadId },
    include: { months: true },
  });
  if (!upload || isOutsideBranch(upload.branchId, branchId, isSuperAdmin)) return;

  const months = upload.months.map((m) => m.month);
  if (months.length > 0) {
    await prisma.timesheetEntry.deleteMany({ where: { month: { in: months } } });
  }
  await prisma.upload.delete({ where: { id: uploadId } });

  await logAudit({
    entityType: "UPLOAD",
    entityId: uploadId,
    action: "DELETE",
    before: { filename: upload.filename, uploadedById: upload.uploadedById, months },
    userId: user.id,
    userName: user.name,
    branchId,
  });

  revalidatePath("/upload");
  revalidatePath("/companies");
  revalidatePath("/");
}
