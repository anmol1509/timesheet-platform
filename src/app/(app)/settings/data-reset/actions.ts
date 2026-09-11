"use server";

import { revalidatePath } from "next/cache";
import { requireUserWithBranch } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { RESET_MODULES } from "@/lib/dataReset";

export async function resetModuleAction(
  formData: FormData
): Promise<{ counts: Record<string, number> } | { error: string }> {
  const { user, branchId } = await requireUserWithBranch();
  if (user.role !== "SUPER_ADMIN") {
    return { error: "Only a Super Admin can reset data." };
  }

  const moduleId = String(formData.get("moduleId") || "");
  const confirmText = String(formData.get("confirmText") || "").trim();
  const acknowledgeGlobal = formData.get("acknowledgeGlobal") === "true";

  const mod = RESET_MODULES.find((m) => m.id === moduleId);
  if (!mod) return { error: "Unknown module." };

  if (confirmText.toUpperCase() !== mod.label.toUpperCase()) {
    return { error: `Type "${mod.label}" exactly to confirm.` };
  }
  if (!mod.branchScoped && !acknowledgeGlobal) {
    return { error: "Confirm you understand this isn't split by branch and affects every branch." };
  }
  if (mod.branchScoped && !branchId) {
    return { error: "Pick a specific branch from the switcher first — this can't run across all branches at once." };
  }

  let counts: Record<string, number>;
  try {
    counts = await mod.run(mod.branchScoped ? branchId : null);
  } catch (e) {
    const detail = e instanceof Error ? e.message : String(e);
    return {
      error: `Reset failed — other data still references these records. Reset a dependent module first, then retry. (${detail})`,
    };
  }

  await logAudit({
    entityType: "DATA_RESET",
    entityId: moduleId,
    action: "DELETE",
    after: counts,
    userId: user.id,
    userName: user.name,
    branchId: mod.branchScoped ? branchId : null,
  });

  revalidatePath("/settings/data-reset");
  return { counts };
}
