"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireUserWithBranch } from "@/lib/auth";
import { isOutsideBranch } from "@/lib/branch";
import { logAudit } from "@/lib/audit";
import { STAGE_BY_KEY, computeReadyToJoin, type StageKey } from "@/lib/onboarding";

type State = { error: string | null; ok?: boolean };

function stringOrNull(v: FormDataEntryValue | null) {
  const s = String(v || "").trim();
  return s || null;
}
function dateOrNull(v: FormDataEntryValue | null) {
  const s = String(v || "").trim();
  return s ? new Date(s) : null;
}

async function assertOnboardingInBranch(id: string, branchId: string | null, isSuperAdmin: boolean) {
  const row = await prisma.candidateOnboarding.findUnique({ where: { id }, select: { branchId: true } });
  return !!row && !isOutsideBranch(row.branchId, branchId, isSuperAdmin);
}

export async function createCandidateAction(_prev: State, formData: FormData): Promise<State> {
  const { user, branchId, isSuperAdmin } = await requireUserWithBranch();
  const candidateName = stringOrNull(formData.get("candidateName"));
  if (!candidateName) return { error: "Candidate name is required." };
  if (!branchId) {
    return { error: isSuperAdmin ? "Pick a branch from the switcher before adding a candidate." : "Your account has no branch assigned — contact an admin." };
  }

  const data = {
    candidateName,
    trade: stringOrNull(formData.get("trade")),
    nationality: stringOrNull(formData.get("nationality")),
    sponsorCompany: stringOrNull(formData.get("sponsorCompany")),
    joiningTargetDate: dateOrNull(formData.get("joiningTargetDate")),
    agencyId: stringOrNull(formData.get("agencyId")),
    demandRequestId: stringOrNull(formData.get("demandRequestId")),
    projectId: stringOrNull(formData.get("projectId")),
    assignedHrId: stringOrNull(formData.get("assignedHrId")),
    remarks: stringOrNull(formData.get("remarks")),
    branchId,
  };

  const candidate = await prisma.candidateOnboarding.create({ data });
  await logAudit({
    entityType: "CANDIDATE_ONBOARDING",
    entityId: candidate.id,
    action: "CREATE",
    after: data,
    userId: user.id,
    userName: user.name,
    branchId,
  });

  revalidatePath("/onboarding");
  redirect(`/onboarding/${candidate.id}`);
}

export async function updateCandidateAction(_prev: State, formData: FormData): Promise<State> {
  const { user, branchId, isSuperAdmin } = await requireUserWithBranch();
  const id = String(formData.get("id") || "");
  if (!(await assertOnboardingInBranch(id, branchId, isSuperAdmin))) return { error: "You can't edit that candidate." };
  const candidateName = stringOrNull(formData.get("candidateName"));
  if (!candidateName) return { error: "Candidate name is required." };

  const before = await prisma.candidateOnboarding.findUnique({ where: { id } });
  if (!before) return { error: "Candidate not found." };

  const data = {
    candidateName,
    trade: stringOrNull(formData.get("trade")),
    nationality: stringOrNull(formData.get("nationality")),
    sponsorCompany: stringOrNull(formData.get("sponsorCompany")),
    joiningTargetDate: dateOrNull(formData.get("joiningTargetDate")),
    agencyId: stringOrNull(formData.get("agencyId")),
    demandRequestId: stringOrNull(formData.get("demandRequestId")),
    projectId: stringOrNull(formData.get("projectId")),
    assignedHrId: stringOrNull(formData.get("assignedHrId")),
    remarks: stringOrNull(formData.get("remarks")),
  };
  await prisma.candidateOnboarding.update({ where: { id }, data });
  await logAudit({
    entityType: "CANDIDATE_ONBOARDING",
    entityId: id,
    action: "UPDATE",
    before: { candidateName: before.candidateName, trade: before.trade, nationality: before.nationality, sponsorCompany: before.sponsorCompany, remarks: before.remarks },
    after: data,
    userId: user.id,
    userName: user.name,
    branchId: before.branchId,
  });

  revalidatePath(`/onboarding/${id}`);
  revalidatePath("/onboarding");
  return { error: null, ok: true };
}

/** Records a stage transition: writes a history row and updates the
 * denormalized *Status column on the master row, then recomputes
 * readyToJoin from the fresh set of statuses — never entered by hand. */
export async function updateStageAction(_prev: State, formData: FormData): Promise<State> {
  const { user, branchId, isSuperAdmin } = await requireUserWithBranch();
  const id = String(formData.get("id") || "");
  const stageKey = String(formData.get("stage") || "") as StageKey;
  const stage = STAGE_BY_KEY[stageKey];
  if (!stage) return { error: "Unknown stage." };
  if (!(await assertOnboardingInBranch(id, branchId, isSuperAdmin))) return { error: "You can't edit that candidate." };

  const newStatus = String(formData.get("status") || "").trim();
  if (!newStatus || !stage.statuses.some((s) => s.value === newStatus)) return { error: "Choose a valid status for this stage." };
  const statusDate = dateOrNull(formData.get("statusDate")) ?? new Date();
  const referenceNo = stringOrNull(formData.get("referenceNo"));
  const expiryDate = dateOrNull(formData.get("expiryDate"));
  const remarks = stringOrNull(formData.get("remarks"));

  const candidate = await prisma.candidateOnboarding.findUnique({ where: { id } });
  if (!candidate) return { error: "Candidate not found." };
  const oldStatus = candidate[stage.field];

  const updated = await prisma.$transaction(async (tx) => {
    await tx.candidateOnboardingHistory.create({
      data: { onboardingId: id, stage: stage.key, oldStatus, newStatus, statusDate, referenceNo, expiryDate, remarks, updatedById: user.id },
    });
    return tx.candidateOnboarding.update({ where: { id }, data: { [stage.field]: newStatus } });
  });

  const readyToJoin = computeReadyToJoin(updated);
  if (readyToJoin !== updated.readyToJoin) {
    await prisma.candidateOnboarding.update({ where: { id }, data: { readyToJoin } });
  }

  await logAudit({
    entityType: "CANDIDATE_ONBOARDING",
    entityId: id,
    action: "UPDATE",
    before: { [stage.field]: oldStatus },
    after: { [stage.field]: newStatus },
    userId: user.id,
    userName: user.name,
    branchId: candidate.branchId,
  });

  revalidatePath(`/onboarding/${id}`);
  revalidatePath("/onboarding");
  return { error: null, ok: true };
}

/** Only reachable once every mandatory stage is done — readyToJoin is
 * recomputed server-side on every stage update, so this can't be raced by
 * clicking through a stale page. */
export async function markJoinedAction(_prev: State, formData: FormData): Promise<State> {
  const { user, branchId, isSuperAdmin } = await requireUserWithBranch();
  const id = String(formData.get("id") || "");
  if (!(await assertOnboardingInBranch(id, branchId, isSuperAdmin))) return { error: "You can't edit that candidate." };

  const candidate = await prisma.candidateOnboarding.findUnique({ where: { id } });
  if (!candidate) return { error: "Candidate not found." };
  if (!candidate.readyToJoin) return { error: "This candidate isn't ready to join yet — every stage must be completed first." };

  const joiningDate = dateOrNull(formData.get("joiningDate")) ?? new Date();
  const employeeId = stringOrNull(formData.get("employeeId"));
  await prisma.candidateOnboarding.update({ where: { id }, data: { joined: true, joiningDate, employeeId } });
  await logAudit({
    entityType: "CANDIDATE_ONBOARDING",
    entityId: id,
    action: "UPDATE",
    before: { joined: false },
    after: { joined: true, joiningDate, employeeId },
    userId: user.id,
    userName: user.name,
    branchId: candidate.branchId,
  });

  revalidatePath(`/onboarding/${id}`);
  revalidatePath("/onboarding");
  return { error: null, ok: true };
}

export async function deleteCandidateAction(formData: FormData) {
  const { user, branchId, isSuperAdmin } = await requireUserWithBranch();
  const id = String(formData.get("id") || "");
  if (!(await assertOnboardingInBranch(id, branchId, isSuperAdmin))) return;
  const candidate = await prisma.candidateOnboarding.findUnique({ where: { id } });
  if (!candidate) return;
  await prisma.candidateOnboarding.delete({ where: { id } });
  await logAudit({
    entityType: "CANDIDATE_ONBOARDING",
    entityId: id,
    action: "DELETE",
    before: { candidateName: candidate.candidateName },
    userId: user.id,
    userName: user.name,
    branchId: candidate.branchId,
  });
  revalidatePath("/onboarding");
}
