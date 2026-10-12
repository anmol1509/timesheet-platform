"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { branchWhere } from "@/lib/branch";
import { resolveSuperAdminBranchId } from "@/lib/auth";

/** Marks one piece of assistant feedback as dealt with (the guide was written or fixed), so the list shows only what still needs a look. */
export async function markFeedbackReviewedAction(formData: FormData) {
  const user = await requireAdmin();
  const id = String(formData.get("id") || "");
  if (!id) return;
  const branchId = user.role === "SUPER_ADMIN" ? await resolveSuperAdminBranchId() : user.branchId;
  await prisma.assistantFeedback.updateMany({ where: { id, ...branchWhere(branchId) }, data: { reviewed: true } });
  revalidatePath("/settings/assistant");
}
