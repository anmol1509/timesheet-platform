"use server";

import { revalidatePath } from "next/cache";
import { requireUserWithBranch } from "@/lib/auth";
import {
  demobiliseEmployees,
  type DemobilisationOutcome,
  type DemobilisationResult,
} from "@/lib/demobilisation";

export async function demobiliseAction(
  formData: FormData
): Promise<{ result?: DemobilisationResult; error?: string }> {
  const { user, branchId, isSuperAdmin } = await requireUserWithBranch();
  if (!branchId) {
    return {
      error: isSuperAdmin
        ? "Pick a branch from the switcher before demobilising."
        : "Your account has no branch assigned — contact an admin.",
    };
  }

  const employeeIds = formData.getAll("employeeId").map(String).filter(Boolean);
  if (employeeIds.length === 0) return { error: "Nobody selected." };

  const rawDate = String(formData.get("date") || "").trim();
  // A demobilisation with no date is the thing this screen exists to record,
  // so a missing or malformed one is refused rather than guessed.
  if (!/^\d{4}-\d{2}-\d{2}$/.test(rawDate)) return { error: "Pick the date they came off site." };

  const outcome = String(formData.get("outcome") || "BENCH") as DemobilisationOutcome;
  if (outcome !== "BENCH" && outcome !== "OFF_BOOKS") return { error: "Pick what happens next." };

  const reason = String(formData.get("reason") || "").trim() || null;

  const result = await demobiliseEmployees(
    employeeIds,
    { date: new Date(rawDate + "T00:00:00.000Z"), reason, outcome },
    { branchId, userId: user.id, userName: user.name, isSuperAdmin }
  );

  revalidatePath("/demand/demobilisation");
  revalidatePath("/demand/mobilisation");
  revalidatePath("/demand/site-arrival");
  revalidatePath("/employees");
  revalidatePath("/attendance");
  for (const id of employeeIds) revalidatePath(`/employees/${id}`);

  return { result };
}
