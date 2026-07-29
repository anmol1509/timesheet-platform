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
      salaryType: stringOrNull(formData.get("salaryType")),
      projectId: stringOrNull(formData.get("projectId")),
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
    },
  });

  revalidatePath(`/employees/${id}`);
  revalidatePath("/employees");
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
