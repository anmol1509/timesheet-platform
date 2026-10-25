"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireUserWithBranch, requireWrite, subjectOf } from "@/lib/auth";
import { isOutsideBranch } from "@/lib/branch";
import { can } from "@/lib/permissions";
import { logAudit } from "@/lib/audit";
import { isCostKind, parseAmount } from "@/lib/candidateCosts";

type State = { error: string | null; ok?: boolean };

/** The candidate, if the signed-in person may record costs against it: onboarding access plus Finance, since these are amounts of money. */
async function guard(candidateId: string) {
  await requireWrite("onboarding.tracker");
  const ctx = await requireUserWithBranch();
  if (!can(subjectOf(ctx.user), "finance", "view")) return { error: "Recording costs needs Finance access." } as const;
  const c = await prisma.candidateOnboarding.findUnique({ where: { id: candidateId }, select: { id: true, branchId: true, candidateName: true } });
  if (!c || isOutsideBranch(c.branchId, ctx.branchId, ctx.isSuperAdmin)) return { error: "You can't edit that candidate." } as const;
  return { ctx, c } as const;
}

export async function addCostAction(_prev: State, formData: FormData): Promise<State> {
  const g = await guard(String(formData.get("id") || ""));
  if ("error" in g) return { error: g.error ?? "You can't edit that candidate." };
  const kind = String(formData.get("kind") || "");
  if (!isCostKind(kind)) return { error: "Choose what the cost is for." };
  const amount = parseAmount(String(formData.get("amount") || ""));
  if (amount === null) return { error: "Enter an amount above zero." };
  const raw = String(formData.get("incurredOn") || "").trim();
  const incurredOn = raw ? new Date(raw) : new Date();
  if (Number.isNaN(incurredOn.getTime())) return { error: "That date doesn't look right." };
  const note = String(formData.get("note") || "").trim().slice(0, 200) || null;
  const paid = formData.get("paid") === "on";
  await prisma.candidateCost.create({ data: { onboardingId: g.c.id, branchId: g.c.branchId, kind, amount, incurredOn, paid, note, createdBy: g.ctx.user.id } });
  await logAudit({ entityType: "CANDIDATE_ONBOARDING", entityId: g.c.id, action: "UPDATE", after: { cost: kind, amount, paid }, userId: g.ctx.user.id, userName: g.ctx.user.name, branchId: g.c.branchId });
  revalidatePath(`/onboarding/${g.c.id}`);
  revalidatePath("/onboarding/agencies");
  return { error: null, ok: true };
}

export async function toggleCostPaidAction(formData: FormData): Promise<void> {
  const cost = await prisma.candidateCost.findUnique({ where: { id: String(formData.get("costId") || "") }, select: { id: true, onboardingId: true, paid: true } });
  if (!cost) return;
  const g = await guard(cost.onboardingId);
  if ("error" in g) return;
  await prisma.candidateCost.update({ where: { id: cost.id }, data: { paid: !cost.paid } });
  await logAudit({ entityType: "CANDIDATE_ONBOARDING", entityId: cost.onboardingId, action: "UPDATE", before: { paid: cost.paid }, after: { paid: !cost.paid }, userId: g.ctx.user.id, userName: g.ctx.user.name, branchId: g.c.branchId });
  revalidatePath(`/onboarding/${cost.onboardingId}`);
  revalidatePath("/onboarding/agencies");
}

export async function deleteCostAction(formData: FormData): Promise<void> {
  const cost = await prisma.candidateCost.findUnique({ where: { id: String(formData.get("costId") || "") }, select: { id: true, onboardingId: true, kind: true, amount: true } });
  if (!cost) return;
  const g = await guard(cost.onboardingId);
  if ("error" in g) return;
  await prisma.candidateCost.delete({ where: { id: cost.id } });
  await logAudit({ entityType: "CANDIDATE_ONBOARDING", entityId: cost.onboardingId, action: "UPDATE", before: { cost: cost.kind, amount: Number(cost.amount) }, after: { cost: "removed" }, userId: g.ctx.user.id, userName: g.ctx.user.name, branchId: g.c.branchId });
  revalidatePath(`/onboarding/${cost.onboardingId}`);
  revalidatePath("/onboarding/agencies");
}
