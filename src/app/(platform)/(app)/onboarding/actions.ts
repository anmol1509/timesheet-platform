"use server";

import { findSupplierByName, uniqueSupplierCode } from "@/lib/entityCode";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireUserWithBranch, requireWrite } from "@/lib/auth";
import { employeeFieldsFromStage, passportProblem } from "@/lib/onboardingEmployee";
import { isOutsideBranch } from "@/lib/branch";
import { logAudit } from "@/lib/audit";
import { contactsError } from "@/lib/validators";
import { refsBelongToBranch } from "@/lib/refScope";
import { STAGE_BY_KEY, asCandidateType, computeReadyToJoin, skippedSteps, type StageKey } from "@/lib/onboarding";

type State = { error: string | null; ok?: boolean; /** Earlier steps still open: the person is asked to confirm before it is saved. */ skipped?: string[] };

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
    candidateType: asCandidateType(stringOrNull(formData.get("candidateType"))),
    candidateName: stringOrNull(formData.get("candidateName")) ?? "",
    trade: stringOrNull(formData.get("trade")),
    nationality: stringOrNull(formData.get("nationality")),
    sponsorSupplierId: stringOrNull(formData.get("sponsorSupplierId")),
    joiningTargetDate: dateOrNull(formData.get("joiningTargetDate")),
    phone: stringOrNull(formData.get("phone")),
    email: stringOrNull(formData.get("email")),
    passportNumber: stringOrNull(formData.get("passportNumber")),
    emiratesId: stringOrNull(formData.get("emiratesId")),
    dateOfBirth: dateOrNull(formData.get("dateOfBirth")),
    gender: stringOrNull(formData.get("gender")),
    bloodGroup: stringOrNull(formData.get("bloodGroup")),
    agencyId: stringOrNull(formData.get("agencyId")),
    agencyContactId: stringOrNull(formData.get("agencyContactId")),
    demandRequestId: stringOrNull(formData.get("demandRequestId")),
    projectId: stringOrNull(formData.get("projectId")),
    assignedHrId: stringOrNull(formData.get("assignedHrId")),
    remarks: stringOrNull(formData.get("remarks")),
  };
}

/**
 * The agency must be a recruitment agency (and not blacklisted, unless it is the one the candidate already has), and the
 * sponsor one of the branch's own companies. Returns the problem, or null.
 */
async function linkProblem(branchId: string, agencyId: string | null, sponsorSupplierId: string | null, keep?: { agencyId: string | null; sponsorSupplierId: string | null }): Promise<string | null> {
  if (!(await refsBelongToBranch(branchId, { supplier: [agencyId, sponsorSupplierId] }))) return "That agency or company isn't in this company.";
  if (agencyId && agencyId !== keep?.agencyId) {
    const a = await prisma.supplier.findUnique({ where: { id: agencyId }, select: { isRecruitmentAgency: true, status: true } });
    if (!a?.isRecruitmentAgency) return "That isn't a recruitment agency. Add it under Onboarding → Agencies first.";
    if (a.status !== "ACTIVE") return "That agency is blacklisted, so no new candidates can be added through it.";
  }
  if (sponsorSupplierId && sponsorSupplierId !== keep?.sponsorSupplierId) {
    const c = await prisma.supplier.findUnique({ where: { id: sponsorSupplierId }, select: { isOwnCompany: true } });
    if (!c?.isOwnCompany) return "The sponsor must be one of your own companies.";
  }
  return null;
}

/** A candidate with the same passport or Emirates ID already tracked (as
 * another candidate, or as a real employee) — the same duplicate guard
 * approveWorkerSubmission() applies before creating an Employee, just moved
 * earlier so it catches the mistake at intake instead of at "Mark joined". */
async function findDuplicate(branchId: string, passportNumber: string | null, emiratesId: string | null, excludeId?: string) {
  if (!passportNumber && !emiratesId) return null;
  const or = [
    ...(passportNumber ? [{ passportNumber: { equals: passportNumber, mode: "insensitive" as const } }] : []),
    ...(emiratesId ? [{ emiratesId }] : []),
  ];
  const [employee, candidate] = await Promise.all([
    // Inside this company only: the same passport at another company is a different record, and must not reveal that company's workers.
    prisma.employee.findFirst({ where: { branchId, OR: or }, select: { id: true, name: true } }),
    prisma.candidateOnboarding.findFirst({ where: { branchId, OR: or, id: excludeId ? { not: excludeId } : undefined }, select: { id: true, candidateName: true } }),
  ]);
  if (employee) return `An employee with this passport or Emirates ID already exists (${employee.name}).`;
  if (candidate) return `Another candidate already has this passport or Emirates ID (${candidate.candidateName}).`;
  return null;
}

export async function createCandidateAction(_prev: State, formData: FormData): Promise<State> {
  await requireWrite("onboarding.tracker");
  try {
    { const invalid = contactsError(formData); if (invalid) return { error: invalid }; }
  } catch (e) {
    return { error: e instanceof Error ? e.message : "That phone number or email doesn't look right." };
  }
  const { user, branchId, isSuperAdmin } = await requireUserWithBranch();
  const fields = profileFields(formData);
  if (!fields.candidateName) return { error: "Candidate name is required." };
  if (!branchId) {
    return { error: isSuperAdmin ? "Sign in as a company administrator before adding a candidate." : "Your account has no company assigned. Contact an admin." };
  }
  const ppBad = passportProblem(fields.passportNumber);
  if (ppBad) return { error: ppBad };
  const dupError = await findDuplicate(branchId, fields.passportNumber, fields.emiratesId);
  if (dupError) return { error: dupError };
  const bad = await linkProblem(branchId, fields.agencyId, fields.sponsorSupplierId);
  if (bad) return { error: bad };

  const data = { ...fields, branchId, lastStageChangeAt: new Date() };
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
  await requireWrite("onboarding.tracker");
  try {
    { const invalid = contactsError(formData); if (invalid) return { error: invalid }; }
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
  const ppBad = passportProblem(fields.passportNumber);
  if (ppBad) return { error: ppBad };
  const dupError = await findDuplicate(before.branchId, fields.passportNumber, fields.emiratesId, id);
  if (dupError) return { error: dupError };
  const bad = await linkProblem(before.branchId, fields.agencyId, fields.sponsorSupplierId, before);
  if (bad) return { error: bad };

  const updatedRow = await prisma.candidateOnboarding.update({ where: { id }, data: fields });
  // A different kind of hire has different steps, so whether they are ready to join has to be worked out again.
  if (computeReadyToJoin(updatedRow) !== updatedRow.readyToJoin) {
    await prisma.candidateOnboarding.update({ where: { id }, data: { readyToJoin: !updatedRow.readyToJoin } });
  }
  await logAudit({
    entityType: "CANDIDATE_ONBOARDING",
    entityId: id,
    action: "UPDATE",
    before: {
      candidateType: before.candidateType,
      candidateName: before.candidateName, trade: before.trade, nationality: before.nationality, sponsorCompany: before.sponsorCompany,
      phone: before.phone, email: before.email, passportNumber: before.passportNumber, emiratesId: before.emiratesId, remarks: before.remarks,
      agencyId: before.agencyId, sponsorSupplierId: before.sponsorSupplierId,
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
  await requireWrite("onboarding.tracker");
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
  const skipped = skippedSteps(candidate, stageKey, newStatus);
  if (skipped.length > 0 && formData.get("confirmSkip") !== "1") return { error: null, skipped };

  const updated = await prisma.$transaction(async (tx) => {
    await tx.candidateOnboardingHistory.create({
      data: { onboardingId: id, stage: stage.key, oldStatus, newStatus, statusDate, referenceNo, expiryDate, remarks, updatedById: user.id },
    });
    return tx.candidateOnboarding.update({ where: { id }, data: { [stage.field]: newStatus, lastStageChangeAt: new Date() } });
  });

  const readyToJoin = computeReadyToJoin(updated);
  if (readyToJoin !== updated.readyToJoin) {
    await prisma.candidateOnboarding.update({ where: { id }, data: { readyToJoin } });
  }

  // Papers that follow arrival (medical, visa stamping, labour card) are recorded after the person has often joined already: their
  // expiry dates go to the employee too, or renewals would never see them.
  if (candidate.joined && candidate.employeeId) {
    const fields = employeeFieldsFromStage(stage.key, expiryDate, referenceNo);
    if (Object.keys(fields).length > 0) {
      const emp = await prisma.employee.update({ where: { id: candidate.employeeId }, data: fields }).catch(() => null);
      if (emp) {
        await logAudit({ entityType: "EMPLOYEE", entityId: emp.id, action: "UPDATE", after: { ...Object.fromEntries(Object.entries(fields).map(([k, v]) => [k, v instanceof Date ? v.toISOString().slice(0, 10) : v])), source: `Candidate onboarding #${candidate.candidateNo}: ${stage.label}` }, userId: user.id, userName: user.name, branchId: candidate.branchId });
        revalidatePath(`/employees/${emp.id}`);
      }
    }
  }

  await logAudit({
    entityType: "CANDIDATE_ONBOARDING",
    entityId: id,
    action: "UPDATE",
    before: { [stage.field]: oldStatus },
    after: { [stage.field]: newStatus, ...(skipped.length > 0 ? { recordedBeforeEarlierSteps: skipped.join(", ") } : {}) },
    userId: user.id,
    userName: user.name,
    branchId: candidate.branchId,
  });

  revalidatePath(`/onboarding/${id}`);
  revalidatePath("/onboarding");
  return { error: null, ok: true };
}

export type CreateAgencyResult = { error: string | null; agency?: { id: string; name: string } };

/** Quick-add for the agency picker — the same "+ add new" pattern as
 * createAgencyContactAction, so an agency the candidate came from doesn't
 * have to already exist in Suppliers before onboarding can start. Creates a
 * real Supplier row (same shape as the Suppliers page's own create action),
 * just with an inline result instead of a redirect. */
export async function createAgencyAction(_prev: CreateAgencyResult, formData: FormData): Promise<CreateAgencyResult> {
  await requireWrite("onboarding.tracker");
  try {
    { const invalid = contactsError(formData); if (invalid) return { error: invalid }; }
  } catch (e) {
    return { error: e instanceof Error ? e.message : "That phone number or email doesn't look right." };
  }
  const { user, branchId, isSuperAdmin } = await requireUserWithBranch();
  const name = stringOrNull(formData.get("name"));
  if (!name) return { error: "Name is required." };
  if (!branchId) {
    return { error: isSuperAdmin ? "Sign in as a company administrator before adding an agency." : "Your account has no company assigned. Contact an admin." };
  }

  const existing = await findSupplierByName(name, branchId);
  if (existing) return { error: "A supplier with that name already exists. If it is the agency you mean, use \u201cAdd an existing supplier\u2026\u201d on this page to mark it as an agency." };

  const code = await uniqueSupplierCode(name, branchId);
  const contactPhone = stringOrNull(formData.get("phone"));
  const contactEmail = stringOrNull(formData.get("email"));
  const country = stringOrNull(formData.get("country"));
  const tradeLicenseNumber = stringOrNull(formData.get("licence"));
  const created = await prisma.supplier.create({ data: { name, code, branchId, contactPhone, contactEmail, country, tradeLicenseNumber, isRecruitmentAgency: true, category: "Recruitment agency" } });
  await logAudit({
    entityType: "SUPPLIER",
    entityId: created.id,
    action: "CREATE",
    after: { name, code, contactPhone, contactEmail, country, tradeLicenseNumber, recruitmentAgency: true },
    userId: user.id,
    userName: user.name,
    branchId,
  });

  revalidatePath("/onboarding");
  revalidatePath("/onboarding/agencies");
  revalidatePath("/suppliers");
  return { error: null, agency: { id: created.id, name: created.name } };
}

export type CreateContactResult = { error: string | null; contact?: { id: string; name: string } };

/** Quick-add for the agency contact picker — the same coordinator usually
 * handles many candidates from one agency, so this is a reusable row, not a
 * free-text field re-typed every time. */
export async function createAgencyContactAction(_prev: CreateContactResult, formData: FormData): Promise<CreateContactResult> {
  await requireWrite("onboarding.tracker");
  try {
    { const invalid = contactsError(formData); if (invalid) return { error: invalid }; }
  } catch (e) {
    return { error: e instanceof Error ? e.message : "That phone number or email doesn't look right." };
  }
  const { user, branchId, isSuperAdmin } = await requireUserWithBranch();
  const agencyId = String(formData.get("agencyId") || "");
  const name = stringOrNull(formData.get("name"));
  if (!agencyId) return { error: "Choose an agency first." };
  if (!name) return { error: "Name is required." };

  const agency = await prisma.supplier.findUnique({ where: { id: agencyId }, select: { branchId: true } });
  if (!agency || isOutsideBranch(agency.branchId, branchId, isSuperAdmin)) return { error: "That agency isn't available." };

  const contact = await prisma.agencyContact.create({
    data: {
      name,
      phone: stringOrNull(formData.get("phone")),
      email: stringOrNull(formData.get("email")),
      agencyId,
      branchId: agency.branchId,
    },
  });
  await logAudit({ entityType: "SUPPLIER", entityId: agencyId, action: "UPDATE", after: { agencyContact: name }, userId: user.id, userName: user.name, branchId: agency.branchId });
  revalidatePath("/onboarding");
  revalidatePath("/onboarding/new");
  return { error: null, contact: { id: contact.id, name: contact.name } };
}

/** Sets who owns a stage and by when — separate from updateStageAction
 * (which records a status change) since assigning an owner doesn't itself
 * change the stage's status or need a history row. */
export async function assignStageTaskAction(_prev: State, formData: FormData): Promise<State> {
  await requireWrite("onboarding.tracker");
  const { branchId, isSuperAdmin } = await requireUserWithBranch();
  const id = String(formData.get("id") || "");
  const stageKey = String(formData.get("stage") || "") as StageKey;
  const stage = STAGE_BY_KEY[stageKey];
  if (!stage) return { error: "Unknown stage." };
  if (!(await assertOnboardingInBranch(id, branchId, isSuperAdmin))) return { error: "You can't edit that candidate." };

  const ownerId = stringOrNull(formData.get("ownerId"));
  const dueDate = dateOrNull(formData.get("dueDate"));

  await prisma.candidateOnboardingStageTask.upsert({
    where: { onboardingId_stage: { onboardingId: id, stage: stage.key } },
    create: { onboardingId: id, stage: stage.key, ownerId, dueDate },
    update: { ownerId, dueDate },
  });

  revalidatePath(`/onboarding/${id}`);
  revalidatePath("/onboarding");
  return { error: null, ok: true };
}

type ImportRowResult = { row: number; status: "created" | "error"; message?: string };

/** Batch intake for a sheet an agency sends — the highest-leverage way to
 * add candidates, since agencies rarely submit one at a time. Only creates;
 * an existing passport/Emirates ID is reported as a row error rather than
 * silently merged, so a resubmitted sheet doesn't duplicate work quietly. */
export async function bulkImportCandidatesAction(rows: Record<string, string>[]): Promise<ImportRowResult[]> {
  await requireWrite("onboarding.tracker");
  const { user, branchId, isSuperAdmin } = await requireUserWithBranch();
  const results: ImportRowResult[] = [];
  if (!branchId) return rows.map((_, i) => ({ row: i + 2, status: "error", message: "No company selected to import into." }));

  const agencyNames = [...new Set(rows.map((r) => (r["Agency"] || "").trim()).filter(Boolean))];
  const agencies = agencyNames.length
    ? await prisma.supplier.findMany({ where: { name: { in: agencyNames }, isRecruitmentAgency: true, status: "ACTIVE", ...(isSuperAdmin ? {} : { branchId }) }, select: { id: true, name: true } })
    : [];
  const agencyByName = new Map(agencies.map((a) => [a.name.toLowerCase(), a.id]));

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const candidateName = (r["Candidate name"] || "").trim();
    if (!candidateName) {
      results.push({ row: i + 2, status: "error", message: "Candidate name is required." });
      continue;
    }
    const passportNumber = stringOrNull(r["Passport number"] ?? null);
    const emiratesId = stringOrNull(r["Emirates ID"] ?? null);
    try {
      const dupError = await findDuplicate(branchId, passportNumber, emiratesId);
      if (dupError) {
        results.push({ row: i + 2, status: "error", message: dupError });
        continue;
      }
      // Without a passport or Emirates ID there is nothing to tell two rows
      // apart but the person's details (whatever the saved candidate holds); the same name with the same phone or
      // email (or neither given) is the same candidate uploaded twice.
      if (!passportNumber && !emiratesId) {
        const phone = stringOrNull(r["Phone"] ?? null);
        const email = stringOrNull(r["Email"] ?? null);
        const same = await prisma.candidateOnboarding.findMany({
          where: { branchId, candidateName: { equals: candidateName, mode: "insensitive" } },
          select: { phone: true, email: true },
        });
        if (same.some((c) => (!phone && !email && !c.phone && !c.email) || (phone && c.phone === phone) || (email && c.email?.toLowerCase() === email.toLowerCase()))) {
          results.push({ row: i + 2, status: "error", message: `${candidateName} is already on the list.` });
          continue;
        }
      }
      const agencyRaw = (r["Agency"] || "").trim();
      if (agencyRaw && !agencyByName.has(agencyRaw.toLowerCase())) {
        results.push({ row: i + 2, status: "error", message: `Agency "${agencyRaw}" isn't a recruitment agency on file. Add it under Onboarding → Agencies first.` });
        continue;
      }
      const data = {
        candidateName,
        trade: stringOrNull(r["Trade"] ?? null),
        nationality: stringOrNull(r["Nationality"] ?? null),
        phone: stringOrNull(r["Phone"] ?? null),
        email: stringOrNull(r["Email"] ?? null),
        passportNumber,
        emiratesId,
        agencyId: agencyRaw ? (agencyByName.get(agencyRaw.toLowerCase()) ?? null) : null,
        branchId,
        lastStageChangeAt: new Date(),
      };
      const created = await prisma.candidateOnboarding.create({ data });
      await logAudit({ entityType: "CANDIDATE_ONBOARDING", entityId: created.id, action: "CREATE", after: data, userId: user.id, userName: user.name, branchId });
      results.push({ row: i + 2, status: "created" });
    } catch (e) {
      results.push({ row: i + 2, status: "error", message: e instanceof Error ? e.message : "Failed to import row." });
    }
  }

  revalidatePath("/onboarding");
  return results;
}

/** Takes a candidate out of the queue and the reminders (withdrew, was rejected, didn't turn up), keeping them for the agency's numbers. */
export async function dropCandidateAction(_prev: State, formData: FormData): Promise<State> {
  await requireWrite("onboarding.tracker");
  const { user, branchId, isSuperAdmin } = await requireUserWithBranch();
  const id = String(formData.get("id") || "");
  if (!(await assertOnboardingInBranch(id, branchId, isSuperAdmin))) return { error: "You can't edit that candidate." };
  const reason = stringOrNull(formData.get("reason"));
  if (!reason) return { error: "Say why: for example withdrew, failed the trade test, or didn't arrive." };
  const c = await prisma.candidateOnboarding.findUnique({ where: { id }, select: { joined: true, droppedAt: true, branchId: true } });
  if (!c) return { error: "Candidate not found." };
  if (c.joined) return { error: "This candidate has already joined as an employee." };
  await prisma.candidateOnboarding.update({ where: { id }, data: { droppedAt: new Date(), droppedReason: reason.slice(0, 200) } });
  await logAudit({ entityType: "CANDIDATE_ONBOARDING", entityId: id, action: "UPDATE", before: { dropped: false }, after: { dropped: true, reason }, userId: user.id, userName: user.name, branchId: c.branchId });
  revalidatePath(`/onboarding/${id}`);
  revalidatePath("/onboarding");
  revalidatePath("/onboarding/agencies");
  return { error: null, ok: true };
}

/** Brings a dropped candidate back into the queue; the clock restarts from now so they aren't instantly overdue. */
export async function reinstateCandidateAction(formData: FormData) {
  await requireWrite("onboarding.tracker");
  const { user, branchId, isSuperAdmin } = await requireUserWithBranch();
  const id = String(formData.get("id") || "");
  if (!(await assertOnboardingInBranch(id, branchId, isSuperAdmin))) return;
  const c = await prisma.candidateOnboarding.findUnique({ where: { id }, select: { droppedAt: true, branchId: true } });
  if (!c?.droppedAt) return;
  await prisma.candidateOnboarding.update({ where: { id }, data: { droppedAt: null, droppedReason: null, lastStageChangeAt: new Date() } });
  await logAudit({ entityType: "CANDIDATE_ONBOARDING", entityId: id, action: "UPDATE", before: { dropped: true }, after: { dropped: false }, userId: user.id, userName: user.name, branchId: c.branchId });
  revalidatePath(`/onboarding/${id}`);
  revalidatePath("/onboarding");
  revalidatePath("/onboarding/agencies");
}

export async function deleteCandidateAction(formData: FormData) {
  await requireWrite("onboarding.tracker");
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
