"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { setActiveBranchCookie } from "@/lib/session";

export async function setActiveBranchAction(formData: FormData) {
  const user = await requireUser();
  if (user.role !== "SUPER_ADMIN") return; // branch-scoped users can't switch

  const branchId = String(formData.get("branchId") || "") || null;
  await setActiveBranchCookie(branchId);
  // Branch selection affects data on every page under this layout, not just
  // the current one.
  revalidatePath("/", "layout");
}
