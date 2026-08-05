"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireUserWithBranch } from "@/lib/auth";
import { isOutsideBranch } from "@/lib/branch";
import { MAX_UPLOAD_BYTES } from "@/lib/constants";

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

export async function updateEmployeeAction(formData: FormData) {
  const { branchId, isSuperAdmin } = await requireUserWithBranch();
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

  await prisma.employee.update({
    where: { id },
    data: {
      category: (stringOrNull(formData.get("category")) as "STAFF" | "SITE_STAFF" | null) ?? undefined,
      sponsorshipCompanyId: stringOrNull(formData.get("sponsorshipCompanyId")),
      nationality: stringOrNull(formData.get("nationality")),
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
      vehicleId: stringOrNull(formData.get("vehicleId")),
      notes: stringOrNull(formData.get("notes")),
      dateOfBirth: dateOrNull(formData.get("dateOfBirth")),
      gender: stringOrNull(formData.get("gender")),
      bloodGroup: stringOrNull(formData.get("bloodGroup")),
      mobileNumber: stringOrNull(formData.get("mobileNumber")),
      whatsappNumber: stringOrNull(formData.get("whatsappNumber")),
      joinDate: dateOrNull(formData.get("joinDate")),
      sponsorName: stringOrNull(formData.get("sponsorName")),
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
    },
  });

  revalidatePath(`/employees/${id}`);
  revalidatePath("/employees");
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
      const data = {
        name,
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
  if (!(await assertEmployeeInBranch(employeeId, branchId, isSuperAdmin))) return;

  const buffer = Buffer.from(await file.arrayBuffer());
  await prisma.document.create({
    data: {
      employeeId,
      type,
      displayInEss,
      filename: file.name,
      fileData: buffer,
      mimeType: file.type || "application/octet-stream",
      expiryDate,
      uploadedById: user.id,
    },
  });

  revalidatePath(`/employees/${employeeId}`);
  revalidatePath("/documents");
}

export async function deleteDocumentAction(formData: FormData) {
  const { branchId, isSuperAdmin } = await requireUserWithBranch();
  const id = String(formData.get("documentId") || "");
  const employeeId = String(formData.get("employeeId") || "");
  if (!id) return;
  if (!(await assertEmployeeInBranch(employeeId, branchId, isSuperAdmin))) return;
  await prisma.document.delete({ where: { id } });
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

  const skill = await prisma.skill.upsert({
    where: { name: skillName },
    update: {},
    create: { name: skillName },
  });

  const detail = {
    proficiencyPercent: proficiencyPercent != null ? Math.round(proficiencyPercent) : null,
    rate,
  };
  await prisma.employeeSkill.upsert({
    where: { employeeId_skillId: { employeeId, skillId: skill.id } },
    update: detail,
    create: { employeeId, skillId: skill.id, ...detail },
  });

  revalidatePath(`/employees/${employeeId}`);
  revalidatePath("/skills");
}

export async function addVaccinationAction(formData: FormData) {
  const { branchId, isSuperAdmin } = await requireUserWithBranch();
  const employeeId = String(formData.get("employeeId") || "");
  const vaccineName = String(formData.get("vaccineName") || "").trim();
  if (!employeeId || !vaccineName) return;
  if (!(await assertEmployeeInBranch(employeeId, branchId, isSuperAdmin))) return;

  await prisma.employeeVaccination.create({
    data: {
      employeeId,
      vaccineName,
      doseNumber: numberOrNull(formData.get("doseNumber")),
      date: dateOrNull(formData.get("date")),
      expiryDate: dateOrNull(formData.get("expiryDate")),
      notes: stringOrNull(formData.get("notes")),
    },
  });

  revalidatePath(`/employees/${employeeId}`);
}

export async function removeVaccinationAction(formData: FormData) {
  const { branchId, isSuperAdmin } = await requireUserWithBranch();
  const employeeId = String(formData.get("employeeId") || "");
  const vaccinationId = String(formData.get("vaccinationId") || "");
  if (!employeeId || !vaccinationId) return;
  if (!(await assertEmployeeInBranch(employeeId, branchId, isSuperAdmin))) return;
  await prisma.employeeVaccination.delete({ where: { id: vaccinationId } }).catch(() => {});
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
  revalidatePath("/skills");
}
