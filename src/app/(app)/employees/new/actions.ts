"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireUserWithBranch } from "@/lib/auth";
import { branchWhere } from "@/lib/branch";
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
  // Issued in place of the Emirates ID card until the card is printed; its
  // expiry is the residency's, so it lands on visaExpiry.
  RESIDENCY_ISSUANCE: "visaExpiry",
};

/**
 * Initials of every word in the company name, which is the convention already
 * in use — "Peak Tower Tiles Fixing Cont" gives PTTFC, matching PTTFC112.
 */
function initialsOf(name: string) {
  return name
    .split(/[\s\-/&.]+/)
    .filter(Boolean)
    .map((word) => word[0])
    .join("")
    .replace(/[^A-Za-z]/g, "")
    .toUpperCase()
    .slice(0, 6);
}

/**
 * Next free employee ID for a company: its initials followed by a serial that
 * continues from the highest existing number under the same prefix, so IDs
 * stay grouped by employer.
 */
export async function generateEmployeeIdAction(
  supplierId: string | null,
  sponsorshipCompanyId: string | null
): Promise<{ id: string | null; error: string | null; source: string | null }> {
  const { branchId } = await requireUserWithBranch();

  const company = supplierId
    ? await prisma.supplier.findUnique({
        where: { id: supplierId },
        select: { name: true },
      })
    : sponsorshipCompanyId
      ? await prisma.sponsorshipCompany.findUnique({
          where: { id: sponsorshipCompanyId },
          select: { name: true },
        })
      : null;

  if (!company) {
    return {
      id: null,
      source: null,
      error: "Pick a supplier or sponsorship company first — the ID is based on it.",
    };
  }

  const prefix = initialsOf(company.name);
  if (!prefix) {
    return { id: null, source: null, error: `Can't build a prefix from "${company.name}".` };
  }

  // Scan existing IDs under this prefix and continue from the highest serial.
  const existing = await prisma.employee.findMany({
    where: { ...branchWhere(branchId), employeeIdNo: { startsWith: prefix } },
    select: { employeeIdNo: true },
  });

  let highest = 0;
  for (const row of existing) {
    const match = row.employeeIdNo.slice(prefix.length).match(/^(\d+)/);
    if (match) highest = Math.max(highest, Number(match[1]));
  }

  const width = Math.max(3, String(highest + 1).length);
  return {
    id: `${prefix}${String(highest + 1).padStart(width, "0")}`,
    source: company.name,
    error: null,
  };
}

/** Flags a clash while the ID is being typed, rather than on save. */
export async function checkEmployeeIdAction(
  employeeIdNo: string
): Promise<{ taken: boolean; name: string | null }> {
  const trimmed = employeeIdNo.trim();
  if (!trimmed) return { taken: false, name: null };
  await requireUserWithBranch();
  const existing = await prisma.employee.findUnique({
    where: { employeeIdNo: trimmed },
    select: { name: true },
  });
  return { taken: !!existing, name: existing?.name ?? null };
}

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
    visaNumber: stringOrNull(formData.get("visaNumber")),
    unifiedNo: stringOrNull(formData.get("unifiedNo")),
    sponsorName: stringOrNull(formData.get("sponsorName")),
    // "APPLIED" when only the ICP registration form is on file — residency is
    // granted but the card hasn't been printed, so there's no number to store.
    eidStatus: stringOrNull(formData.get("eidStatus")),
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

  // The document pack can be several files at once (passport scan, ID card
  // photos, labour card). Each is stored against the employee; the type is
  // whatever the client resolved it to, defaulting to OTHER.
  const packFiles = formData.getAll("docFile_PACK");
  for (const [index, file] of packFiles.entries()) {
    if (!(file instanceof File) || file.size === 0) continue;
    if (file.size > MAX_UPLOAD_BYTES) continue;
    const type = stringOrNull(formData.get(`packType_${index}`)) || "OTHER";
    const doc = await prisma.document.create({
      data: {
        employeeId: employee.id,
        type,
        filename: file.name,
        fileData: Buffer.from(await file.arrayBuffer()),
        mimeType: file.type || "application/octet-stream",
        expiryDate: null,
        uploadedById: user.id,
      },
    });
    await logAudit({
      entityType: "DOCUMENT",
      entityId: doc.id,
      action: "CREATE",
      after: { employeeId: employee.id, type, filename: file.name },
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
  // Back to the roster rather than the new employee's own page — registering
  // is usually one of a batch, so the list is where the next one starts.
  redirect("/employees");
}
