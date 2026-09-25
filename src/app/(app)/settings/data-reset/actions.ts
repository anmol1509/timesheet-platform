"use server";

import { revalidatePath } from "next/cache";
import { requireUserWithBranch } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { prisma } from "@/lib/db";
import { RESET_MODULES, SAFE_RESET_ORDER } from "@/lib/dataReset";
import { assertContactsValid } from "@/lib/validators";

function checkAccess(role: string) {
  return role === "SUPER_ADMIN";
}

export async function resetModuleAction(
  formData: FormData
): Promise<{ counts: Record<string, number> } | { error: string }> {
  assertContactsValid(formData);
  const { user, branchId } = await requireUserWithBranch();
  if (!checkAccess(user.role)) {
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
  // A module reset is "global" either because it was never split by branch
  // (Accommodation, Transport) or because no specific branch is currently
  // selected — either way, more than just the one branch you're looking at
  // is affected, so it needs the same explicit acknowledgment.
  const isGlobalRun = !mod.branchScoped || !branchId;
  if (isGlobalRun && !acknowledgeGlobal) {
    return {
      error: mod.branchScoped
        ? "Confirm you understand this runs across every branch, since no specific branch is selected."
        : "Confirm you understand this isn't split by branch and affects every branch.",
    };
  }

  let counts: Record<string, number>;
  try {
    counts = await prisma.$transaction((tx) => mod.run(branchId, tx), { timeout: 20000 });
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

// Resets every module in one shot, in SAFE_RESET_ORDER, inside a single
// transaction — either everything deletes, or (any module's foreign-key
// conflict, which shouldn't happen given the order, but data can always
// surprise you) nothing does. Deliberately its own stronger confirmation
// phrase, not just each module's name, since this is irreversibly clearing
// nearly the entire database at once.
export async function resetAllAction(
  formData: FormData
): Promise<{ counts: Record<string, Record<string, number>> } | { error: string }> {
  assertContactsValid(formData);
  const { user, branchId } = await requireUserWithBranch();
  if (!checkAccess(user.role)) {
    return { error: "Only a Super Admin can reset data." };
  }

  const confirmText = String(formData.get("confirmText") || "").trim();
  const acknowledgeGlobal = formData.get("acknowledgeGlobal") === "true";

  if (confirmText.toUpperCase() !== "RESET ALL") {
    return { error: 'Type "RESET ALL" exactly to confirm.' };
  }
  if (!acknowledgeGlobal) {
    return { error: "Confirm you understand this deletes every module's data, including modules that affect every branch." };
  }

  let allCounts: Record<string, Record<string, number>>;
  try {
    allCounts = await prisma.$transaction(async (tx) => {
      const results: Record<string, Record<string, number>> = {};
      for (const id of SAFE_RESET_ORDER) {
        const mod = RESET_MODULES.find((m) => m.id === id);
        if (!mod) continue;
        results[mod.label] = await mod.run(mod.branchScoped ? branchId : null, tx);
      }
      return results;
    }, { timeout: 60000 });
  } catch (e) {
    const detail = e instanceof Error ? e.message : String(e);
    return { error: `Reset All failed partway through — nothing was deleted (the whole thing is one transaction). (${detail})` };
  }

  await logAudit({
    entityType: "DATA_RESET",
    entityId: "ALL",
    action: "DELETE",
    after: allCounts,
    userId: user.id,
    userName: user.name,
    branchId,
  });

  revalidatePath("/settings/data-reset");
  return { counts: allCounts };
}
