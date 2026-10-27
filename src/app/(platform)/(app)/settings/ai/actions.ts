"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireAdmin, requireSuperAdmin } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { aiBranchOf, createCreditRequest, grantBranchCredits, MAX_REQUEST_CREDITS, setBranchAllowance } from "@/lib/aiCreditsServer";

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
  if (!branchId) return { error: "Pick a company first." };
  if (!Number.isFinite(credits) || credits < 0 || credits > 10_000_000) return { error: "Enter a whole number of credits between 0 and 10,000,000." };
  const before = await prisma.branch.findUnique({ where: { id: branchId }, select: { aiMonthlyCredits: true } });
  if (!before) return { error: "That company wasn't found." };
  await setBranchAllowance(branchId, credits);
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
  if (!branchId) return { error: "Pick a company first." };
  if (!Number.isFinite(credits) || credits <= 0 || credits > 1_000_000) return { error: "Enter a whole number of credits between 1 and 1,000,000." };
  if (!(await prisma.branch.findUnique({ where: { id: branchId }, select: { id: true } }))) return { error: "That company wasn't found." };
  await grantBranchCredits(branchId, credits, note, user.id);
  await logAudit({ entityType: "BRANCH", entityId: branchId, action: "UPDATE", after: { aiCreditsGranted: credits, note }, userId: user.id, userName: user.name, branchId });
  revalidatePath("/settings/ai");
  return { error: null, ok: true };
}

/** A company admin asks for extra credits this month. The owner approves it and the credits are added. */
export async function requestCreditsAction(_prev: State, formData: FormData): Promise<State> {
  const user = await requireAdmin();
  const branchId = await aiBranchOf(user);
  if (!branchId) return { error: "Pick a company first." };
  const credits = wholeNumber(formData.get("credits"));
  const reason = String(formData.get("reason") || "").trim().slice(0, 300) || null;
  if (!Number.isFinite(credits) || credits < 1 || credits > MAX_REQUEST_CREDITS) return { error: `Enter a whole number of credits between 1 and ${MAX_REQUEST_CREDITS.toLocaleString("en-US")}.` };
  const waiting = await prisma.aiCreditRequest.count({ where: { branchId, status: "PENDING" } });
  if (waiting >= 3) return { error: "You already have requests waiting. They will be answered soon." };
  await createCreditRequest({ branchId, userId: user.id, userName: user.name, credits, reason });
  revalidatePath("/settings/ai");
  return { error: null, ok: true };
}
