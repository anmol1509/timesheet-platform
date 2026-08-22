"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireUserWithBranch } from "@/lib/auth";
import { isOutsideBranch } from "@/lib/branch";
import { logAudit } from "@/lib/audit";
import { clampSkillLevel } from "@/lib/skillLevel";
import { releaseFromMobilisation } from "@/lib/employeeStageTransitions";
import { MAX_UPLOAD_BYTES } from "@/lib/constants";
import {
  isAcceptedPhotoType,
  isAcceptedUploadType,
  safeFilename,
} from "@/lib/uploads";

// Every nested mutation (documents, skills, photo) takes an employeeId
// rather than looking the employee up itself, so this is the one place
// that guards them all against acting on another branch's employee.
async function assertEmployeeInBranch(employeeId: string, branchId: string | null, isSuperAdmin: boolean) {
  const employee = await prisma.employee.findUnique({ where: { id: employeeId }, select: { branchId: true } });
  return !!employee && !isOutsideBranch(employee.branchId, branchId, isSuperAdmin);
}

function dateOrNull(value: FormDataEntryValue | null) {
  const s = String(value || "").trim();
  return s ? new Date(s) : null;
}

function stringOrNull(value: FormDataEntryValue | null) {
  const s = String(value || "").trim();
  return s || null;
}

function numberOrNull(value: FormDataEntryValue | null) {
  const s = String(value || "").trim();
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

export async function updateEmployeeAction(formData: FormData): Promise<{ error?: string } | void> {
  const { user, branchId, isSuperAdmin } = await requireUserWithBranch();
  const id = String(formData.get("employeeId") || "");
  if (!id) return;
  if (!(await assertEmployeeInBranch(id, branchId, isSuperAdmin))) return;

  const active = formData.get("active") === "on";
  const inactiveReasonPreset = stringOrNull(formData.get("inactiveReasonPreset"));
  const inactiveReason = active
    ? null
    : inactiveReasonPreset === "Other"
      ? stringOrNull(formData.get("inactiveReasonCustom"))
      : inactiveReasonPreset;

  const before = await prisma.employee.findUnique({ where: { id } });

  // Name and employee ID were captured at registration and then frozen — a
  // typo in either was permanent without database access.
  const name = String(formData.get("name") || "").trim();
  if (!name) return { error: "Name can't be empty." };

  const employeeIdNo = String(formData.get("employeeIdNo") || "").trim();
  if (!employeeIdNo) return { error: "Employee ID can't be empty." };
  if (employeeIdNo !== before?.employeeIdNo) {
    // Unique across the whole table, so a clash has to be caught here rather
    // than surfacing as a Prisma constraint error.
    const clash = await prisma.employee.findUnique({
      where: { employeeIdNo },
      select: { id: true },
    });
    if (clash && clash.id !== id) {
      return { error: `Employee ID ${employeeIdNo} is already taken.` };
    }
  }

  const data = {
      name,
      employeeIdNo,
      category: (stringOrNull(formData.get("category")) as "STAFF" | "SITE_STAFF" | null) ?? undefined,
      supplierId: stringOrNull(formData.get("supplierId")),
      sponsorSupplierId: stringOrNull(formData.get("sponsorSupplierId")),
      nationality: stringOrNull(formData.get("nationality")),
      sponsorName: stringOrNull(formData.get("sponsorName")),
      unifiedNo: stringOrNull(formData.get("unifiedNo")),
      position: stringOrNull(formData.get("position")),
      passportNumber: stringOrNull(formData.get("passportNumber")),
      emiratesId: stringOrNull(formData.get("emiratesId")),
      visaExpiry: dateOrNull(formData.get("visaExpiry")),
      laborCardExpiry: dateOrNull(formData.get("laborCardExpiry")),
      medicalExpiry: dateOrNull(formData.get("medicalExpiry")),
      passportExpiry: dateOrNull(formData.get("passportExpiry")),
      emiratesIdExpiry: dateOrNull(formData.get("emiratesIdExpiry")),
      salaryType: stringOrNull(formData.get("salaryType")),
      salaryRate: numberOrNull(formData.get("salaryRate")),
      projectId: stringOrNull(formData.get("projectId")),
      siteId: stringOrNull(formData.get("siteId")),
      vehicleId: stringOrNull(formData.get("vehicleId")),
      notes: stringOrNull(formData.get("notes")),
      dateOfBirth: dateOrNull(formData.get("dateOfBirth")),
      gender: stringOrNull(formData.get("gender")),
      bloodGroup: stringOrNull(formData.get("bloodGroup")),
      mobileNumber: stringOrNull(formData.get("mobileNumber")),
      whatsappNumber: stringOrNull(formData.get("whatsappNumber")),
      joinDate: dateOrNull(formData.get("joinDate")),
      emergencyContactName: stringOrNull(formData.get("emergencyContactName")),
      emergencyContactPhone: stringOrNull(formData.get("emergencyContactPhone")),
      laborCardNumber: stringOrNull(formData.get("laborCardNumber")),
      wpsBankName: stringOrNull(formData.get("wpsBankName")),
      wpsIban: stringOrNull(formData.get("wpsIban")),
      wpsPaymentMode: stringOrNull(formData.get("wpsPaymentMode")),
      wpsRoutingCode: stringOrNull(formData.get("wpsRoutingCode")),
      wpsAccountHolderName: stringOrNull(formData.get("wpsAccountHolderName")),
      wpsAccountNumber: stringOrNull(formData.get("wpsAccountNumber")),
      active,
      inactiveReason,
      lastDemobilizedDate: dateOrNull(formData.get("lastDemobilizedDate")),
      religion: stringOrNull(formData.get("religion")),
      state: stringOrNull(formData.get("state")),
      accommodationType: stringOrNull(formData.get("accommodationType")),
      previousId: stringOrNull(formData.get("previousId")),
      nameInIdCard: stringOrNull(formData.get("nameInIdCard")),

      medicalStatus: stringOrNull(formData.get("medicalStatus")),
      eidStatus: stringOrNull(formData.get("eidStatus")),

      visaNumber: stringOrNull(formData.get("visaNumber")),
      visaType: stringOrNull(formData.get("visaType")),
      visaStatus: stringOrNull(formData.get("visaStatus")),
      visaDesignation: stringOrNull(formData.get("visaDesignation")),
      visaStampingDate: dateOrNull(formData.get("visaStampingDate")),
      molPersonCode: stringOrNull(formData.get("molPersonCode")),

      passportStatus: stringOrNull(formData.get("passportStatus")),
      passportReleaseDate: dateOrNull(formData.get("passportReleaseDate")),
      passportReturnDate: dateOrNull(formData.get("passportReturnDate")),

      laborCardPersonalNo: stringOrNull(formData.get("laborCardPersonalNo")),
      laborCardStatus: stringOrNull(formData.get("laborCardStatus")),

      cicpaNumber: stringOrNull(formData.get("cicpaNumber")),
      cicpaIssueDate: dateOrNull(formData.get("cicpaIssueDate")),
      cicpaExpiry: dateOrNull(formData.get("cicpaExpiry")),
      cicpaStatus: stringOrNull(formData.get("cicpaStatus")),
      cicpaLocation: stringOrNull(formData.get("cicpaLocation")),

      insuranceCardType: stringOrNull(formData.get("insuranceCardType")),
      insuranceCardNumber: stringOrNull(formData.get("insuranceCardNumber")),
      insuranceIssueDate: dateOrNull(formData.get("insuranceIssueDate")),
      insuranceExpiry: dateOrNull(formData.get("insuranceExpiry")),
      insuranceStatus: stringOrNull(formData.get("insuranceStatus")),
      insuranceServiceProvider: stringOrNull(formData.get("insuranceServiceProvider")),

      drivingLicenceNumber: stringOrNull(formData.get("drivingLicenceNumber")),
      drivingLicenceIssueDate: dateOrNull(formData.get("drivingLicenceIssueDate")),
      drivingLicenceExpiry: dateOrNull(formData.get("drivingLicenceExpiry")),
      drivingLicenceType: stringOrNull(formData.get("drivingLicenceType")),
      drivingLicenceStatus: stringOrNull(formData.get("drivingLicenceStatus")),
  };

  if (before && data.supplierId && before.supplierId !== data.supplierId) {
    const newSupplier = await prisma.supplier.findUnique({
      where: { id: data.supplierId },
      select: { approvalStatus: true },
    });
    if (newSupplier && newSupplier.approvalStatus !== "Approved") {
      return { error: "This supplier isn't approved yet — approve it before assigning employees to it." };
    }
  }

  if (before && data.projectId && before.projectId !== data.projectId && before.supplierId) {
    const supplier = await prisma.supplier.findUnique({
      where: { id: before.supplierId },
      select: { approvalStatus: true },
    });
    if (supplier && supplier.approvalStatus !== "Approved") {
      return { error: "This supplier isn't approved yet — approve it before assigning its employees to a project." };
    }
  }

  // A site belongs to one project, so a site left over from the previous
  // project is a contradiction rather than stale data. The form filters the
  // dropdown already; this is the same rule where it can't be bypassed.
  if (data.siteId) {
    const site = await prisma.site.findUnique({
      where: { id: data.siteId },
      select: { projectId: true },
    });
    if (!site || site.projectId !== data.projectId) data.siteId = null;
  }

  await prisma.employee.update({ where: { id }, data });

  // Taking the project away ends the placement, so the mobilisation stage and
  // its dates end with it — same rule the demand screen applies when a worker
  // is unallocated, so the two routes can't leave the roster disagreeing.
  if (before && before.projectId && !data.projectId) {
    await releaseFromMobilisation([id]);
  }

  if (before && before.projectId !== data.projectId) {
    const openHistory = await prisma.employeeAssignmentHistory.findFirst({
      where: { employeeId: id, demobilizedDate: null },
      orderBy: { mobilizedDate: "desc" },
    });
    if (openHistory) {
      await prisma.employeeAssignmentHistory.update({
        where: { id: openHistory.id },
        data: { demobilizedDate: new Date() },
      });
    }
    if (data.projectId) {
      const [project, branch] = await Promise.all([
        prisma.project.findUnique({ where: { id: data.projectId }, select: { name: true } }),
        before.branchId ? prisma.branch.findUnique({ where: { id: before.branchId }, select: { name: true } }) : null,
      ]);
      await prisma.employeeAssignmentHistory.create({
        data: {
          employeeId: id,
          projectId: data.projectId,
          projectName: project?.name ?? null,
          branchName: branch?.name ?? null,
        },
      });
    }
  }

  await logAudit({
    entityType: "EMPLOYEE",
    entityId: id,
    action: "UPDATE",
    before: before as unknown as Record<string, unknown>,
    after: data as unknown as Record<string, unknown>,
    userId: user.id,
    userName: user.name,
    branchId,
  });

  revalidatePath(`/employees/${id}`);
  revalidatePath("/employees");
  revalidatePath("/demand/site-arrival");
}

export async function bulkImportEmployeesAction(rows: Record<string, string>[]) {
  const { branchId, isSuperAdmin } = await requireUserWithBranch();
  const results: { row: number; status: "created" | "updated" | "error"; message?: string }[] = [];

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const employeeIdNo = (r["Employee ID No"] || "").trim();
    const name = (r["Full name"] || "").trim();
    if (!employeeIdNo || !name) {
      results.push({ row: i + 2, status: "error", message: "Employee ID No and Full name are required." });
      continue;
    }
    if (!branchId) {
      results.push({ row: i + 2, status: "error", message: "No branch selected to import into." });
      continue;
    }
    try {
      const existing = await prisma.employee.findUnique({ where: { employeeIdNo } });
      if (existing && isOutsideBranch(existing.branchId, branchId, isSuperAdmin)) {
        results.push({ row: i + 2, status: "error", message: "That ID belongs to a different branch." });
        continue;
      }
      const categoryRaw = (r["Category"] || "").trim().toLowerCase();
      const category: "STAFF" | "SITE_STAFF" | undefined =
        categoryRaw === "staff" ? "STAFF" : categoryRaw === "site staff" ? "SITE_STAFF" : undefined;
      const data = {
        name,
        category,
        trade: stringOrNull(r["Trade"] ?? null),
        nationality: stringOrNull(r["Nationality"] ?? null),
        position: stringOrNull(r["Position"] ?? null),
        passportNumber: stringOrNull(r["Passport number"] ?? null),
        emiratesId: stringOrNull(r["Emirates ID"] ?? null),
        mobileNumber: stringOrNull(r["Mobile number"] ?? null),
      };
      if (existing) {
        await prisma.employee.update({ where: { id: existing.id }, data });
        results.push({ row: i + 2, status: "updated" });
      } else {
        await prisma.employee.create({ data: { employeeIdNo, ...data, branchId } });
        results.push({ row: i + 2, status: "created" });
      }
    } catch (e) {
      results.push({
        row: i + 2,
        status: "error",
        message: e instanceof Error ? e.message : "Failed to import row.",
      });
    }
  }

  revalidatePath("/employees");
  return results;
}

export async function uploadPhotoAction(formData: FormData) {
  const { branchId, isSuperAdmin } = await requireUserWithBranch();
  const id = String(formData.get("employeeId") || "");
  const file = formData.get("photo");
  if (!id || !(file instanceof File) || file.size === 0) return;
  if (file.size > MAX_UPLOAD_BYTES) return;
  if (!isAcceptedPhotoType(file.type)) return;
  if (!(await assertEmployeeInBranch(id, branchId, isSuperAdmin))) return;

  const buffer = Buffer.from(await file.arrayBuffer());
  await prisma.employee.update({
    where: { id },
    data: { photoData: buffer, photoMimeType: file.type || "image/jpeg" },
  });

  revalidatePath(`/employees/${id}`);
  revalidatePath("/employees");
}

export async function applyExtractedFieldsAction(formData: FormData) {
  const { branchId, isSuperAdmin } = await requireUserWithBranch();
  const employeeId = String(formData.get("employeeId") || "");
  if (!employeeId) return;
  if (!(await assertEmployeeInBranch(employeeId, branchId, isSuperAdmin))) return;

  const data: {
    name?: string;
    passportNumber?: string;
    emiratesId?: string;
    dateOfBirth?: Date;
    nationality?: string;
  } = {};
  const name = stringOrNull(formData.get("name"));
  const passportNumber = stringOrNull(formData.get("passportNumber"));
  const emiratesId = stringOrNull(formData.get("emiratesId"));
  const nationality = stringOrNull(formData.get("nationality"));
  const dateOfBirth = dateOrNull(formData.get("dateOfBirth"));
  if (name) data.name = name;
  if (passportNumber) data.passportNumber = passportNumber;
  if (emiratesId) data.emiratesId = emiratesId;
  if (nationality) data.nationality = nationality;
  if (dateOfBirth) data.dateOfBirth = dateOfBirth;
  if (Object.keys(data).length === 0) return;

  await prisma.employee.update({ where: { id: employeeId }, data });
  revalidatePath(`/employees/${employeeId}`);
}

export async function uploadDocumentAction(formData: FormData) {
  const { user, branchId, isSuperAdmin } = await requireUserWithBranch();
  const employeeId = String(formData.get("employeeId") || "");
  const type = String(formData.get("type") || "OTHER");
  const expiryDate = dateOrNull(formData.get("expiryDate"));
  const displayInEss = formData.get("displayInEss") === "on";
  const file = formData.get("file");
  if (!employeeId || !(file instanceof File) || file.size === 0) return;
  if (file.size > MAX_UPLOAD_BYTES) return;
  // The browser's type is client-controlled, and these files are served back
  // from our own origin — an HTML or SVG upload would run as first-party
  // script. See src/lib/uploads.ts.
  if (!isAcceptedUploadType(file.type)) return;
  if (!(await assertEmployeeInBranch(employeeId, branchId, isSuperAdmin))) return;

  const buffer = Buffer.from(await file.arrayBuffer());
  const created = await prisma.document.create({
    data: {
      employeeId,
      type,
      displayInEss,
      filename: safeFilename(file.name),
      fileData: buffer,
      mimeType: file.type || "application/octet-stream",
      expiryDate,
      uploadedById: user.id,
    },
  });

  await logAudit({
    entityType: "DOCUMENT",
    entityId: created.id,
    action: "CREATE",
    after: { employeeId, type, filename: file.name, expiryDate, displayInEss },
    userId: user.id,
    userName: user.name,
    branchId,
  });

  revalidatePath(`/employees/${employeeId}`);
  revalidatePath("/documents");
}

export async function deleteDocumentAction(formData: FormData) {
  const { user, branchId, isSuperAdmin } = await requireUserWithBranch();
  const id = String(formData.get("documentId") || "");
  const employeeId = String(formData.get("employeeId") || "");
  if (!id) return;
  if (!(await assertEmployeeInBranch(employeeId, branchId, isSuperAdmin))) return;

  // Guarding `employeeId` alone would let a valid employee id be paired with
  // any other branch's document id, so the target is checked against it.
  const existing = await prisma.document.findUnique({ where: { id } });
  if (!existing || existing.employeeId !== employeeId) return;
  await prisma.document.delete({ where: { id } });

  if (existing) {
    await logAudit({
      entityType: "DOCUMENT",
      entityId: id,
      action: "DELETE",
      before: { employeeId, type: existing.type, filename: existing.filename, expiryDate: existing.expiryDate },
      userId: user.id,
      userName: user.name,
      branchId,
    });
  }

  revalidatePath(`/employees/${employeeId}`);
  revalidatePath("/documents");
}

export async function addSkillAction(formData: FormData) {
  const { branchId, isSuperAdmin } = await requireUserWithBranch();
  const employeeId = String(formData.get("employeeId") || "");
  const skillName = String(formData.get("skillName") || "").trim();
  const proficiencyPercent = numberOrNull(formData.get("proficiencyPercent"));
  const rate = numberOrNull(formData.get("rate"));
  if (!employeeId || !skillName) return;
  if (!(await assertEmployeeInBranch(employeeId, branchId, isSuperAdmin))) return;

  // Case-insensitive, so adding "carpenter" here folds into an existing
  // "Carpentry" rather than creating a second skill — the third and last place
  // this upsert was still exact-matching.
  const existingSkill = await prisma.skill.findFirst({
    where: { name: { equals: skillName, mode: "insensitive" } },
  });
  const skill =
    existingSkill ?? (await prisma.skill.create({ data: { name: skillName } }));

  const detail = {
    proficiencyPercent:
      proficiencyPercent != null ? clampSkillLevel(proficiencyPercent) : null,
    rate,
  };
  await prisma.employeeSkill.upsert({
    where: { employeeId_skillId: { employeeId, skillId: skill.id } },
    update: detail,
    create: { employeeId, skillId: skill.id, ...detail },
  });

  revalidatePath(`/employees/${employeeId}`);
  revalidatePath("/trades");
}

export async function addVisaApplicationAction(formData: FormData) {
  const { user, branchId, isSuperAdmin } = await requireUserWithBranch();
  const employeeId = String(formData.get("employeeId") || "");
  const stage = String(formData.get("stage") || "").trim();
  if (!employeeId || !stage) return;
  if (!(await assertEmployeeInBranch(employeeId, branchId, isSuperAdmin))) return;

  const date = dateOrNull(formData.get("date"));
  const notes = stringOrNull(formData.get("notes"));
  const documentId = stringOrNull(formData.get("documentId"));

  const created = await prisma.visaApplication.create({
    data: { employeeId, stage, date, notes, documentId },
  });

  await logAudit({
    entityType: "VISA_APPLICATION",
    entityId: created.id,
    action: "CREATE",
    after: { employeeId, stage, date, notes, documentId },
    userId: user.id,
    userName: user.name,
    branchId,
  });

  revalidatePath(`/employees/${employeeId}`);
}

export async function removeVisaApplicationAction(formData: FormData) {
  const { user, branchId, isSuperAdmin } = await requireUserWithBranch();
  const employeeId = String(formData.get("employeeId") || "");
  const id = String(formData.get("visaApplicationId") || "");
  if (!employeeId || !id) return;
  if (!(await assertEmployeeInBranch(employeeId, branchId, isSuperAdmin))) return;

  const existing = await prisma.visaApplication.findUnique({ where: { id } });
  if (!existing || existing.employeeId !== employeeId) return;
  await prisma.visaApplication.delete({ where: { id } }).catch(() => {});

  if (existing) {
    await logAudit({
      entityType: "VISA_APPLICATION",
      entityId: id,
      action: "DELETE",
      before: { employeeId, stage: existing.stage, date: existing.date, notes: existing.notes },
      userId: user.id,
      userName: user.name,
      branchId,
    });
  }

  revalidatePath(`/employees/${employeeId}`);
}

export async function addLabourCardApplicationAction(formData: FormData) {
  const { user, branchId, isSuperAdmin } = await requireUserWithBranch();
  const employeeId = String(formData.get("employeeId") || "");
  const stage = String(formData.get("stage") || "").trim();
  if (!employeeId || !stage) return;
  if (!(await assertEmployeeInBranch(employeeId, branchId, isSuperAdmin))) return;

  const date = dateOrNull(formData.get("date"));
  const notes = stringOrNull(formData.get("notes"));
  const documentId = stringOrNull(formData.get("documentId"));

  const created = await prisma.labourCardApplication.create({
    data: { employeeId, stage, date, notes, documentId },
  });

  await logAudit({
    entityType: "LABOUR_CARD_APPLICATION",
    entityId: created.id,
    action: "CREATE",
    after: { employeeId, stage, date, notes, documentId },
    userId: user.id,
    userName: user.name,
    branchId,
  });

  revalidatePath(`/employees/${employeeId}`);
}

export async function removeLabourCardApplicationAction(formData: FormData) {
  const { user, branchId, isSuperAdmin } = await requireUserWithBranch();
  const employeeId = String(formData.get("employeeId") || "");
  const id = String(formData.get("labourCardApplicationId") || "");
  if (!employeeId || !id) return;
  if (!(await assertEmployeeInBranch(employeeId, branchId, isSuperAdmin))) return;

  const existing = await prisma.labourCardApplication.findUnique({ where: { id } });
  if (!existing || existing.employeeId !== employeeId) return;
  await prisma.labourCardApplication.delete({ where: { id } }).catch(() => {});

  if (existing) {
    await logAudit({
      entityType: "LABOUR_CARD_APPLICATION",
      entityId: id,
      action: "DELETE",
      before: { employeeId, stage: existing.stage, date: existing.date, notes: existing.notes },
      userId: user.id,
      userName: user.name,
      branchId,
    });
  }

  revalidatePath(`/employees/${employeeId}`);
}

export async function removeSkillAction(formData: FormData) {
  const { branchId, isSuperAdmin } = await requireUserWithBranch();
  const employeeId = String(formData.get("employeeId") || "");
  const skillId = String(formData.get("skillId") || "");
  if (!employeeId || !skillId) return;
  if (!(await assertEmployeeInBranch(employeeId, branchId, isSuperAdmin))) return;
  await prisma.employeeSkill
    .delete({ where: { employeeId_skillId: { employeeId, skillId } } })
    .catch(() => {});
  revalidatePath(`/employees/${employeeId}`);
  revalidatePath("/trades");
}

/**
 * Adds a note to an employee, with optional attachments.
 *
 * Notes could be written during registration and then never seen again — the
 * detail page had no way to read or add them, so anything recorded at
 * onboarding was effectively write-only.
 */
export async function addEmployeeNoteAction(formData: FormData) {
  const { user, branchId, isSuperAdmin } = await requireUserWithBranch();
  const employeeId = String(formData.get("employeeId") || "");
  if (!employeeId) return;
  if (!(await assertEmployeeInBranch(employeeId, branchId, isSuperAdmin))) return;

  const remarks = String(formData.get("remarks") || "").trim();
  const files = formData
    .getAll("files")
    .filter(
      (f): f is File =>
        f instanceof File &&
        f.size > 0 &&
        f.size <= MAX_UPLOAD_BYTES &&
        isAcceptedUploadType(f.type)
    );
  if (!remarks && files.length === 0) return;

  const note = await prisma.employeeNote.create({
    data: { employeeId, remarks, createdById: user.id },
  });

  for (const file of files) {
    await prisma.document.create({
      data: {
        employeeId,
        noteId: note.id,
        type: "NOTE",
        filename: safeFilename(file.name),
        fileData: Buffer.from(await file.arrayBuffer()),
        mimeType: file.type || "application/octet-stream",
        uploadedById: user.id,
      },
    });
  }

  await logAudit({
    entityType: "EMPLOYEE_NOTE",
    entityId: note.id,
    action: "CREATE",
    after: { employeeId, remarks, files: files.length },
    userId: user.id,
    userName: user.name,
    branchId,
  });

  revalidatePath(`/employees/${employeeId}`);
}

export async function deleteEmployeeNoteAction(formData: FormData) {
  const { user, branchId, isSuperAdmin } = await requireUserWithBranch();
  const employeeId = String(formData.get("employeeId") || "");
  const noteId = String(formData.get("noteId") || "");
  if (!employeeId || !noteId) return;
  if (!(await assertEmployeeInBranch(employeeId, branchId, isSuperAdmin))) return;

  // The note id is checked against the employee it was guarded under, so a
  // valid employee can't be paired with someone else's note.
  const existing = await prisma.employeeNote.findUnique({ where: { id: noteId } });
  if (!existing || existing.employeeId !== employeeId) return;

  // Attachments cascade via Document.noteId.
  await prisma.employeeNote.delete({ where: { id: noteId } });

  await logAudit({
    entityType: "EMPLOYEE_NOTE",
    entityId: noteId,
    action: "DELETE",
    before: existing as unknown as Record<string, unknown>,
    userId: user.id,
    userName: user.name,
    branchId,
  });

  revalidatePath(`/employees/${employeeId}`);
}
