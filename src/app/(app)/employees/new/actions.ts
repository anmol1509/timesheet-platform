"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireUserWithBranch } from "@/lib/auth";
import { MAX_UPLOAD_BYTES, MAX_UPLOAD_LABEL } from "@/lib/constants";
import { logAudit } from "@/lib/audit";

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

const DOC_TYPE_TO_EXPIRY_FIELD: Record<string, string> = {
  PASSPORT: "passportExpiry",
  VISA: "visaExpiry",
  LABOR_CARD: "laborCardExpiry",
  MEDICAL: "medicalExpiry",
  EMIRATES_ID: "emiratesIdExpiry",
};

export async function createEmployeeAction(
  _prevState: { error: string | null },
  formData: FormData
): Promise<{ error: string | null }> {
  const { user, branchId, isSuperAdmin } = await requireUserWithBranch();

  const employeeIdNo = String(formData.get("employeeIdNo") || "").trim();
  const name = String(formData.get("name") || "").trim();
  if (!employeeIdNo || !name) {
    return { error: "Employee ID and name are required." };
  }
  if (!branchId) {
    return {
      error: isSuperAdmin
        ? "Pick a branch from the switcher before adding an employee."
        : "Your account has no branch assigned — contact an admin.",
    };
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

  const data = {
    employeeIdNo,
    name,
    branchId,
    category: (stringOrNull(formData.get("category")) as "STAFF" | "SITE_STAFF" | null) ?? undefined,
    // Supplier and sponsorship are interrelated but distinct: the supplier
    // employs the worker, the sponsorship company holds the visa. Supplier was
    // previously only settable from the edit form, never at creation.
    supplierId: stringOrNull(formData.get("supplierId")),
    sponsorshipCompanyId: stringOrNull(formData.get("sponsorshipCompanyId")),
    nationality: stringOrNull(formData.get("nationality")),
    position: stringOrNull(formData.get("position")),
    trade: stringOrNull(formData.get("position")),
    gender: stringOrNull(formData.get("gender")),
    mobileNumber: stringOrNull(formData.get("mobileNumber")),
    joinDate: dateOrNull(formData.get("joinDate")),
    passportNumber: stringOrNull(formData.get("passportNumber")),
    emiratesId: stringOrNull(formData.get("emiratesId")),
    dateOfBirth: dateOrNull(formData.get("dateOfBirth")),
    visaExpiry: dateOrNull(formData.get("visaExpiry")),
    laborCardNumber: stringOrNull(formData.get("laborCardNumber")),
    laborCardPersonalNo: stringOrNull(formData.get("laborCardPersonalNo")),
    laborCardExpiry: dateOrNull(formData.get("laborCardExpiry")),
    medicalExpiry: dateOrNull(formData.get("medicalExpiry")),
    passportExpiry: dateOrNull(formData.get("passportExpiry")),
    emiratesIdExpiry: dateOrNull(formData.get("emiratesIdExpiry")),
    notes: stringOrNull(formData.get("notes")),
    projectId: stringOrNull(formData.get("projectId")),
    salaryType: stringOrNull(formData.get("salaryType")),
    salaryRate: numberOrNull(formData.get("salaryRate")),
    photoData:
      photo instanceof File && photo.size > 0
        ? Buffer.from(await photo.arrayBuffer())
        : undefined,
    photoMimeType:
      photo instanceof File && photo.size > 0 ? photo.type : undefined,
  };

  const employee = await prisma.employee.create({ data });

  await logAudit({
    entityType: "EMPLOYEE",
    entityId: employee.id,
    action: "CREATE",
    after: { ...data, photoData: undefined },
    userId: user.id,
    userName: user.name,
    branchId,
  });

  for (const [type, expiryField] of Object.entries(DOC_TYPE_TO_EXPIRY_FIELD)) {
    const file = formData.get(`docFile_${type}`);
    if (!(file instanceof File) || file.size === 0) continue;
    if (file.size > MAX_UPLOAD_BYTES) continue;
    const expiryDate = dateOrNull(formData.get(expiryField));
    const doc = await prisma.document.create({
      data: {
        employeeId: employee.id,
        type,
        filename: file.name,
        fileData: Buffer.from(await file.arrayBuffer()),
        mimeType: file.type || "application/octet-stream",
        expiryDate,
        uploadedById: user.id,
      },
    });

    await logAudit({
      entityType: "DOCUMENT",
      entityId: doc.id,
      action: "CREATE",
      after: { employeeId: employee.id, type, filename: file.name, expiryDate },
      userId: user.id,
      userName: user.name,
      branchId,
    });
  }

  const additionalFile = formData.get("docFile_ADDITIONAL");
  if (additionalFile instanceof File && additionalFile.size > 0 && additionalFile.size <= MAX_UPLOAD_BYTES) {
    const additionalType = stringOrNull(formData.get("additionalDocType")) || "OTHER";
    const additionalExpiry = dateOrNull(formData.get("additionalDocExpiry"));
    const doc = await prisma.document.create({
      data: {
        employeeId: employee.id,
        type: additionalType,
        filename: additionalFile.name,
        fileData: Buffer.from(await additionalFile.arrayBuffer()),
        mimeType: additionalFile.type || "application/octet-stream",
        expiryDate: additionalExpiry,
        uploadedById: user.id,
      },
    });

    await logAudit({
      entityType: "DOCUMENT",
      entityId: doc.id,
      action: "CREATE",
      after: { employeeId: employee.id, type: additionalType, filename: additionalFile.name, expiryDate: additionalExpiry },
      userId: user.id,
      userName: user.name,
      branchId,
    });
  }

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
