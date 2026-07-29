"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { MAX_UPLOAD_BYTES, MAX_UPLOAD_LABEL } from "@/lib/constants";

function dateOrNull(value: FormDataEntryValue | null) {
  const s = String(value || "").trim();
  return s ? new Date(s) : null;
}

function stringOrNull(value: FormDataEntryValue | null) {
  const s = String(value || "").trim();
  return s || null;
}

export async function createEmployeeAction(
  _prevState: { error: string | null },
  formData: FormData
): Promise<{ error: string | null }> {
  await requireUser();

  const employeeIdNo = String(formData.get("employeeIdNo") || "").trim();
  const name = String(formData.get("name") || "").trim();
  if (!employeeIdNo || !name) {
    return { error: "Employee ID and name are required." };
  }

  const existing = await prisma.employee.findUnique({
    where: { employeeIdNo },
  });
  if (existing) {
    return { error: `An employee with ID ${employeeIdNo} already exists.` };
  }

  const photo = formData.get("photo");
  if (photo instanceof File && photo.size > MAX_UPLOAD_BYTES) {
    return { error: `Photo is too large — max ${MAX_UPLOAD_LABEL}.` };
  }
  const skillsRaw = String(formData.get("skills") || "");
  const skillNames = skillsRaw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  const employee = await prisma.employee.create({
    data: {
      employeeIdNo,
      name,
      nationality: stringOrNull(formData.get("nationality")),
      position: stringOrNull(formData.get("position")),
      trade: stringOrNull(formData.get("position")),
      passportNumber: stringOrNull(formData.get("passportNumber")),
      emiratesId: stringOrNull(formData.get("emiratesId")),
      visaExpiry: dateOrNull(formData.get("visaExpiry")),
      laborCardExpiry: dateOrNull(formData.get("laborCardExpiry")),
      medicalExpiry: dateOrNull(formData.get("medicalExpiry")),
      passportExpiry: dateOrNull(formData.get("passportExpiry")),
      notes: stringOrNull(formData.get("notes")),
      projectId: stringOrNull(formData.get("projectId")),
      salaryType: stringOrNull(formData.get("salaryType")),
      photoData:
        photo instanceof File && photo.size > 0
          ? Buffer.from(await photo.arrayBuffer())
          : undefined,
      photoMimeType:
        photo instanceof File && photo.size > 0 ? photo.type : undefined,
    },
  });

  for (const skillName of skillNames) {
    const skill = await prisma.skill.upsert({
      where: { name: skillName },
      update: {},
      create: { name: skillName },
    });
    await prisma.employeeSkill.create({
      data: { employeeId: employee.id, skillId: skill.id },
    });
  }

  revalidatePath("/employees");
  redirect(`/employees/${employee.id}`);
}
