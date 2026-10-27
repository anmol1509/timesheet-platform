"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireSuperAdmin } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { loadCreditStatus } from "@/lib/aiCreditsServer";

type State = { error: string | null; ok?: boolean };

const wholeNumber = (v: FormDataEntryValue | null) => {
  const n = Number(String(v ?? "").replace(/,/g, "").trim());
  return Number.isInteger(n) ? n : NaN;
};

/** A branch's monthly AI allowance, in credits. Only a super admin sets it. */
export async function setAiAllowanceAction(_prev: State, formData: FormData): Promise<State> {
  const user = await requireSuperAdmin();
  const branchId = String(formData.get("branchId") || "");
  const credits = wholeNumber(formData.get("credits"));
  if (!branchId) return { error: "Pick a branch first." };
  if (!Number.isFinite(credits) || credits < 0 || credits > 10_000_000) return { error: "Enter a whole number of credits between 0 and 10,000,000." };
  const before = await prisma.branch.findUnique({ where: { id: branchId }, select: { aiMonthlyCredits: true } });
  if (!before) return { error: "That branch wasn't found." };
  await prisma.branch.update({ where: { id: branchId }, data: { aiMonthlyCredits: credits } });
  await resetWarning(branchId);
  await logAudit({ entityType: "BRANCH", entityId: branchId, action: "UPDATE", before: { aiMonthlyCredits: before.aiMonthlyCredits }, after: { aiMonthlyCredits: credits }, userId: user.id, userName: user.name, branchId });
  revalidatePath("/settings/ai");
  return { error: null, ok: true };
}

/** Extra credits for the current month, on top of the allowance. */
export async function grantAiCreditsAction(_prev: State, formData: FormData): Promise<State> {
  const user = await requireSuperAdmin();
  const branchId = String(formData.get("branchId") || "");
  const credits = wholeNumber(formData.get("credits"));
  const note = String(formData.get("note") || "").trim().slice(0, 200) || null;
  if (!branchId) return { error: "Pick a branch first." };
  if (!Number.isFinite(credits) || credits <= 0 || credits > 1_000_000) return { error: "Enter a whole number of credits between 1 and 1,000,000." };
  if (!(await prisma.branch.findUnique({ where: { id: branchId }, select: { id: true } }))) return { error: "That branch wasn't found." };
  await prisma.aiCreditGrant.create({ data: { branchId, credits, note, grantedById: user.id } });
  await resetWarning(branchId);
  await logAudit({ entityType: "BRANCH", entityId: branchId, action: "UPDATE", after: { aiCreditsGranted: credits, note }, userId: user.id, userName: user.name, branchId });
  revalidatePath("/settings/ai");
  return { error: null, ok: true };
}

/** After the total changes, the warnings start again from where the branch now stands, so a later 80% is announced again. */
async function resetWarning(branchId: string) {
  const s = await loadCreditStatus(branchId);
  await prisma.branch.update({ where: { id: branchId }, data: { aiWarnedMonth: s.month, aiWarnedLevel: s.level === "out" ? 100 : s.level === "warn" ? 80 : 0 } });
}
