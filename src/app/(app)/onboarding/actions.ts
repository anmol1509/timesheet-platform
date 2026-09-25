"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireUserWithBranch } from "@/lib/auth";
import { isOutsideBranch } from "@/lib/branch";
import { logAudit } from "@/lib/audit";
import { assertContactsValid } from "@/lib/validators";
import { initialsOf, nextEmployeeId } from "@/lib/supplierRequests";
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

function profileFields(formData: FormData) {
  return {
    candidateName: stringOrNull(formData.get("candidateName")) ?? "",
    trade: stringOrNull(formData.get("trade")),
    nationality: stringOrNull(formData.get("nationality")),
    sponsorCompany: stringOrNull(formData.get("sponsorCompany")),
    joiningTargetDate: dateOrNull(formData.get("joiningTargetDate")),
    phone: stringOrNull(formData.get("phone")),
    email: stringOrNull(formData.get("email")),
    passportNumber: stringOrNull(formData.get("passportNumber")),
    emiratesId: stringOrNull(formData.get("emiratesId")),
    dateOfBirth: dateOrNull(formData.get("dateOfBirth")),
    gender: stringOrNull(formData.get("gender")),
    bloodGroup: stringOrNull(formData.get("bloodGroup")),
    agencyId: stringOrNull(formData.get("agencyId")),
    demandRequestId: stringOrNull(formData.get("demandRequestId")),
    projectId: stringOrNull(formData.get("projectId")),
    assignedHrId: stringOrNull(formData.get("assignedHrId")),
    remarks: stringOrNull(formData.get("remarks")),
  };
}

/** A candidate with the same passport or Emirates ID already tracked (as
 * another candidate, or as a real employee) — the same duplicate guard
 * approveWorkerSubmission() applies before creating an Employee, just moved
 * earlier so it catches the mistake at intake instead of at "Mark joined". */
async function findDuplicate(passportNumber: string | null, emiratesId: string | null, excludeId?: string) {
  if (!passportNumber && !emiratesId) return null;
  const or = [
    ...(passportNumber ? [{ passportNumber: { equals: passportNumber, mode: "insensitive" as const } }] : []),
    ...(emiratesId ? [{ emiratesId }] : []),
  ];
  const [employee, candidate] = await Promise.all([
    prisma.employee.findFirst({ where: { OR: or }, select: { id: true, name: true } }),
    prisma.candidateOnboarding.findFirst({ where: { OR: or, id: excludeId ? { not: excludeId } : undefined }, select: { id: true, candidateName: true } }),
  ]);
  if (employee) return `An employee with this passport or Emirates ID already exists (${employee.name}).`;
  if (candidate) return `Another candidate already has this passport or Emirates ID (${candidate.candidateName}).`;
  return null;
}

export async function createCandidateAction(_prev: State, formData: FormData): Promise<State> {
  try {
    assertContactsValid(formData);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "That phone number or email doesn't look right." };
  }
  const { user, branchId, isSuperAdmin } = await requireUserWithBranch();
  const fields = profileFields(formData);
  if (!fields.candidateName) return { error: "Candidate name is required." };
  if (!branchId) {
    return { error: isSuperAdmin ? "Pick a branch from the switcher before adding a candidate." : "Your account has no branch assigned — contact an admin." };
  }
  const dupError = await findDuplicate(fields.passportNumber, fields.emiratesId);
  if (dupError) return { error: dupError };

  const data = { ...fields, branchId };
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
  try {
    assertContactsValid(formData);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "That phone number or email doesn't look right." };
  }
  const { user, branchId, isSuperAdmin } = await requireUserWithBranch();
  const id = String(formData.get("id") || "");
  if (!(await assertOnboardingInBranch(id, branchId, isSuperAdmin))) return { error: "You can't edit that candidate." };
  const fields = profileFields(formData);
  if (!fields.candidateName) return { error: "Candidate name is required." };

  const before = await prisma.candidateOnboarding.findUnique({ where: { id } });
  if (!before) return { error: "Candidate not found." };
  const dupError = await findDuplicate(fields.passportNumber, fields.emiratesId, id);
  if (dupError) return { error: dupError };

  await prisma.candidateOnboarding.update({ where: { id }, data: fields });
  await logAudit({
    entityType: "CANDIDATE_ONBOARDING",
    entityId: id,
    action: "UPDATE",
    before: {
      candidateName: before.candidateName, trade: before.trade, nationality: before.nationality, sponsorCompany: before.sponsorCompany,
      phone: before.phone, email: before.email, passportNumber: before.passportNumber, emiratesId: before.emiratesId, remarks: before.remarks,
    },
    after: fields,
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
 * clicking through a stale page. Creates the real Employee record here
 * (mirrors approveWorkerSubmission()'s ID generation and duplicate check) —
 * this is the one moment a candidate becomes an employee, since everything
 * before this point deliberately isn't one yet. */
export async function markJoinedAction(_prev: State, formData: FormData): Promise<State> {
  const { user, branchId, isSuperAdmin } = await requireUserWithBranch();
  const id = String(formData.get("id") || "");
  if (!(await assertOnboardingInBranch(id, branchId, isSuperAdmin))) return { error: "You can't edit that candidate." };

  const candidate = await prisma.candidateOnboarding.findUnique({ where: { id }, include: { agency: { select: { name: true } } } });
  if (!candidate) return { error: "Candidate not found." };
  if (candidate.joined) return { error: "This candidate has already joined." };
  if (!candidate.readyToJoin) return { error: "This candidate isn't ready to join yet — every stage must be completed first." };
  if (!candidate.agency) return { error: "Set an agency for this candidate first — it's used to generate their employee ID." };
  if (!candidate.passportNumber || !candidate.emiratesId || !candidate.phone) {
    return { error: "Add passport number, Emirates ID and phone to the candidate's profile before marking them joined." };
  }

  const dupError = await findDuplicate(candidate.passportNumber, candidate.emiratesId, id);
  if (dupError) return { error: dupError };

  const prefix = initialsOf(candidate.agency.name);
  if (!prefix) return { error: "Can't build an employee ID prefix from the agency's name." };
  const joiningDate = dateOrNull(formData.get("joiningDate")) ?? new Date();

  const [taken, medicalExpiry, idVisaExpiry] = await Promise.all([
    prisma.employee.findMany({ where: { employeeIdNo: { startsWith: prefix } }, select: { employeeIdNo: true } }),
    prisma.candidateOnboardingHistory.findFirst({ where: { onboardingId: id, stage: "MEDICAL", expiryDate: { not: null } }, orderBy: { updatedAt: "desc" }, select: { expiryDate: true } }),
    prisma.candidateOnboardingHistory.findFirst({ where: { onboardingId: id, stage: "ID_VISA", expiryDate: { not: null } }, orderBy: { updatedAt: "desc" }, select: { expiryDate: true } }),
  ]);
  const employeeIdNo = nextEmployeeId(prefix, taken.map((t) => t.employeeIdNo));

  const employee = await prisma.$transaction(async (tx) => {
    const e = await tx.employee.create({
      data: {
        employeeIdNo,
        name: candidate.candidateName,
        branchId: candidate.branchId,
        supplierId: candidate.agencyId,
        projectId: candidate.projectId,
        status: "IDLE",
        nationality: candidate.nationality,
        gender: candidate.gender,
        mobileNumber: candidate.phone,
        dateOfBirth: candidate.dateOfBirth,
        joinDate: joiningDate,
        trade: candidate.trade,
        position: candidate.trade,
        bloodGroup: candidate.bloodGroup,
        passportNumber: candidate.passportNumber,
        emiratesId: candidate.emiratesId,
        medicalExpiry: medicalExpiry?.expiryDate ?? null,
        visaExpiry: idVisaExpiry?.expiryDate ?? null,
      },
    });
    await tx.candidateOnboarding.update({ where: { id }, data: { joined: true, joiningDate, employeeId: e.id } });
    return e;
  });

  await logAudit({
    entityType: "CANDIDATE_ONBOARDING",
    entityId: id,
    action: "UPDATE",
    before: { joined: false },
    after: { joined: true, joiningDate, employeeId: employee.id },
    userId: user.id,
    userName: user.name,
    branchId: candidate.branchId,
  });
  await logAudit({
    entityType: "EMPLOYEE",
    entityId: employee.id,
    action: "CREATE",
    after: { employeeIdNo, name: candidate.candidateName, source: "Candidate onboarding" },
    userId: user.id,
    userName: user.name,
    branchId: candidate.branchId,
  });

  revalidatePath(`/onboarding/${id}`);
  revalidatePath("/onboarding");
  revalidatePath("/employees");
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
