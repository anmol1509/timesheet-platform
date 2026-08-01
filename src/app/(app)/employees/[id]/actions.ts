"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { MAX_UPLOAD_BYTES } from "@/lib/constants";

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
  await requireUser();
  const id = String(formData.get("employeeId") || "");
  if (!id) return;

  await prisma.employee.update({
    where: { id },
    data: {
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
      active: formData.get("active") === "on",
      inactiveReason: stringOrNull(formData.get("inactiveReason")),
      lastDemobilizedDate: dateOrNull(formData.get("lastDemobilizedDate")),
      religion: stringOrNull(formData.get("religion")),
      state: stringOrNull(formData.get("state")),
      accommodationType: stringOrNull(formData.get("accommodationType")),
      previousId: stringOrNull(formData.get("previousId")),
      nameInIdCard: stringOrNull(formData.get("nameInIdCard")),
    },
  });

  revalidatePath(`/employees/${id}`);
  revalidatePath("/employees");
}

export async function bulkImportEmployeesAction(rows: Record<string, string>[]) {
  await requireUser();
  const results: { row: number; status: "created" | "updated" | "error"; message?: string }[] = [];

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const employeeIdNo = (r["Employee ID No"] || "").trim();
    const name = (r["Full name"] || "").trim();
    if (!employeeIdNo || !name) {
      results.push({ row: i + 2, status: "error", message: "Employee ID No and Full name are required." });
      continue;
    }
    try {
      const existing = await prisma.employee.findUnique({ where: { employeeIdNo } });
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
        await prisma.employee.create({ data: { employeeIdNo, ...data } });
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
  await requireUser();
  const id = String(formData.get("employeeId") || "");
  const file = formData.get("photo");
  if (!id || !(file instanceof File) || file.size === 0) return;
  if (file.size > MAX_UPLOAD_BYTES) return;

  const buffer = Buffer.from(await file.arrayBuffer());
  await prisma.employee.update({
    where: { id },
    data: { photoData: buffer, photoMimeType: file.type || "image/jpeg" },
  });

  revalidatePath(`/employees/${id}`);
  revalidatePath("/employees");
}

export async function applyExtractedFieldsAction(formData: FormData) {
  await requireUser();
  const employeeId = String(formData.get("employeeId") || "");
  if (!employeeId) return;

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
  const user = await requireUser();
  const employeeId = String(formData.get("employeeId") || "");
  const type = String(formData.get("type") || "OTHER");
  const expiryDate = dateOrNull(formData.get("expiryDate"));
  const file = formData.get("file");
  if (!employeeId || !(file instanceof File) || file.size === 0) return;
  if (file.size > MAX_UPLOAD_BYTES) return;

  const buffer = Buffer.from(await file.arrayBuffer());
  await prisma.document.create({
    data: {
      employeeId,
      type,
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
  await requireUser();
  const id = String(formData.get("documentId") || "");
  const employeeId = String(formData.get("employeeId") || "");
  if (!id) return;
  await prisma.document.delete({ where: { id } });
  revalidatePath(`/employees/${employeeId}`);
  revalidatePath("/documents");
}

export async function addSkillAction(formData: FormData) {
  await requireUser();
  const employeeId = String(formData.get("employeeId") || "");
  const skillName = String(formData.get("skillName") || "").trim();
  if (!employeeId || !skillName) return;

  const skill = await prisma.skill.upsert({
    where: { name: skillName },
    update: {},
    create: { name: skillName },
  });

  await prisma.employeeSkill.upsert({
    where: { employeeId_skillId: { employeeId, skillId: skill.id } },
    update: {},
    create: { employeeId, skillId: skill.id },
  });

  revalidatePath(`/employees/${employeeId}`);
  revalidatePath("/skills");
}

export async function removeSkillAction(formData: FormData) {
  await requireUser();
  const employeeId = String(formData.get("employeeId") || "");
  const skillId = String(formData.get("skillId") || "");
  if (!employeeId || !skillId) return;
  await prisma.employeeSkill
    .delete({ where: { employeeId_skillId: { employeeId, skillId } } })
    .catch(() => {});
  revalidatePath(`/employees/${employeeId}`);
  revalidatePath("/skills");
}
