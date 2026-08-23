"use server";

import { revalidatePath } from "next/cache";
import { requireUserWithBranch } from "@/lib/auth";
import { applyDivergences } from "@/lib/attendanceTimesheetSync";

export async function applyDivergencesAction(formData: FormData) {
  const { user, branchId, isSuperAdmin } = await requireUserWithBranch();
  if (!branchId) {
    return {
      applied: 0,
      error: isSuperAdmin
        ? "Pick a branch from the switcher before syncing."
        : "Your account has no branch assigned — contact an admin.",
    };
  }

  const month = String(formData.get("month") || "").trim();
  if (!/^\d{4}-\d{2}$/.test(month)) return { applied: 0, error: "Pick a month." };

  const result = await applyDivergences(
    {
      month,
      clientId: String(formData.get("clientId") || "").trim() || undefined,
      projectId: String(formData.get("projectId") || "").trim() || undefined,
    },
    { branchId, userId: user.id, userName: user.name, isSuperAdmin }
  );

  revalidatePath("/invoices/client-timesheet/sync");
  revalidatePath("/invoices/client-timesheet");
  return { applied: result.written, result };
}
