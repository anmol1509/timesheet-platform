"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireUserWithBranch } from "@/lib/auth";
import { branchWhere, isOutsideBranch } from "@/lib/branch";
import { MAX_UPLOAD_BYTES, MAX_UPLOAD_LABEL } from "@/lib/constants";
import {
  isAcceptedPhotoType,
  isAcceptedUploadType,
  safeFilename,
} from "@/lib/uploads";
import { logAudit } from "@/lib/audit";
import { clampSkillLevel } from "@/lib/skillLevel";

/**
 * Skills arrive as JSON so each can carry its proficiency level. Anything
 * malformed is treated as "no skills" rather than failing the registration —
 * a bad level shouldn't cost the operator the whole form.
 */
function parseSkills(raw: FormDataEntryValue | null): {
  name: string;
  level: number;
  isActive: boolean;
  rateType: string | null;
  rate: number | null;
}[] {
  try {
    const parsed = JSON.parse(String(raw || "[]"));
    if (!Array.isArray(parsed)) return [];
    return parsed.flatMap((entry) => {
      const name = String(entry?.name ?? "").trim();
      if (!name) return [];
      const rate = Number(entry?.rate);
      return [
        {
          name,
          level: clampSkillLevel(entry?.level),
          isActive: !!entry?.isActive,
          rateType: entry?.rateType === "HOURLY" || entry?.rateType === "FIXED"
            ? entry.rateType
            : null,
          rate: Number.isFinite(rate) && rate > 0 ? rate : null,
        },
      ];
    });
  } catch {
    return [];
  }
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

  // Scoped to the branch, so the generated prefix can't disclose the name of
  // another branch's company.
  const company = supplierId
    ? await prisma.supplier.findFirst({
        where: { id: supplierId, ...branchWhere(branchId) },
        select: { name: true },
      })
    : sponsorshipCompanyId
      ? await prisma.sponsorshipCompany.findFirst({
          where: { id: sponsorshipCompanyId, ...branchWhere(branchId) },
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
  const { branchId, isSuperAdmin } = await requireUserWithBranch();
  // employeeIdNo is unique across the whole table, so the clash check has to
  // look everywhere — but the name behind an out-of-branch clash isn't ours
  // to show.
  const existing = await prisma.employee.findUnique({
    where: { employeeIdNo: trimmed },
    select: { name: true, branchId: true },
  });
  if (!existing) return { taken: false, name: null };
  const visible = !isOutsideBranch(existing.branchId, branchId, isSuperAdmin);
  return { taken: true, name: visible ? existing.name : "another branch" };
}

export async function createEmployeeAction(
  _prevState: { error: string | null; createdId?: string },
  formData: FormData
): Promise<{ error: string | null; createdId?: string }> {
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
  if (photo instanceof File && photo.size > 0) {
    if (photo.size > MAX_UPLOAD_BYTES) {
      return { error: `Photo is too large — max ${MAX_UPLOAD_LABEL}.` };
    }
    if (!isAcceptedPhotoType(photo.type)) {
      return { error: "That photo isn't an image file we can store." };
    }
  }
  // Ids arrive from the form, so they're checked against this branch rather
  // than trusted — otherwise an employee could be filed under another
  // branch's supplier, sponsor or project.
  const supplierId = stringOrNull(formData.get("supplierId"));
  const sponsorshipCompanyId = stringOrNull(formData.get("sponsorshipCompanyId"));
  const projectId = stringOrNull(formData.get("projectId"));
  const [supplierOk, sponsorshipOk, projectOk] = await Promise.all([
    supplierId
      ? prisma.supplier.count({ where: { id: supplierId, ...branchWhere(branchId) } })
      : Promise.resolve(1),
    sponsorshipCompanyId
      ? prisma.sponsorshipCompany.count({
          where: { id: sponsorshipCompanyId, ...branchWhere(branchId) },
        })
      : Promise.resolve(1),
    projectId
      ? prisma.project.count({ where: { id: projectId, ...branchWhere(branchId) } })
      : Promise.resolve(1),
  ]);
  if (!supplierOk || !sponsorshipOk || !projectOk) {
    return { error: "That supplier, sponsorship company or project isn't in your branch." };
  }

  const skillEntries = parseSkills(formData.get("skills"));

  const data = {
    employeeIdNo,
    name,
    branchId,
    category: (stringOrNull(formData.get("category")) as "STAFF" | "SITE_STAFF" | null) ?? undefined,
    // Supplier and sponsorship are interrelated but distinct: the supplier
    // employs the worker, the sponsorship company holds the visa. Supplier was
    // previously only settable from the edit form, never at creation.
    supplierId,
    sponsorshipCompanyId,
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
    projectId,
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
    if (!isAcceptedUploadType(file.type)) continue;
    const expiryDate = dateOrNull(formData.get(expiryField));
    const doc = await prisma.document.create({
      data: {
        employeeId: employee.id,
        type,
        filename: safeFilename(file.name),
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
  for (const file of packFiles) {
    if (!(file instanceof File) || file.size === 0) continue;
    if (file.size > MAX_UPLOAD_BYTES) continue;
    if (!isAcceptedUploadType(file.type)) continue;
    // A pack is a bundle of several documents, so it gets its own type rather
    // than borrowing whichever one happened to be listed first.
    const type = "DOCUMENT_PACK";
    const doc = await prisma.document.create({
      data: {
        employeeId: employee.id,
        type,
        filename: safeFilename(file.name),
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
  if (
    additionalFile instanceof File &&
    additionalFile.size > 0 &&
    additionalFile.size <= MAX_UPLOAD_BYTES &&
    isAcceptedUploadType(additionalFile.type)
  ) {
    const additionalType = stringOrNull(formData.get("additionalDocType")) || "OTHER";
    const additionalExpiry = dateOrNull(formData.get("additionalDocExpiry"));
    const doc = await prisma.document.create({
      data: {
        employeeId: employee.id,
        type: additionalType,
        filename: safeFilename(additionalFile.name),
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

  for (const entry of skillEntries) {
    // Matched case-insensitively so "Carpentry" and "carpentry" don't become
    // two skills — the same rule the Skills module uses.
    const existingSkill = await prisma.skill.findFirst({
      where: { name: { equals: entry.name, mode: "insensitive" } },
    });
    const skill =
      existingSkill ?? (await prisma.skill.create({ data: { name: entry.name } }));
    await prisma.employeeSkill.create({
      data: {
        employeeId: employee.id,
        skillId: skill.id,
        proficiencyPercent: entry.level,
        isActive: entry.isActive,
        rateType: entry.rateType,
        rate: entry.rate,
      },
    });
  }

  // `Employee.trade` is what the roster, demands and timesheets read, so the
  // active trade is mirrored onto it rather than living only on the join.
  const activeTrade = skillEntries.find((e) => e.isActive);
  if (activeTrade) {
    await prisma.employee.update({
      where: { id: employee.id },
      data: { trade: activeTrade.name, position: activeTrade.name },
    });
  }

  // Notes are indexed on the form; each carries its own remarks and files.
  const noteCount = Number(formData.get("noteCount") || 0);
  for (let i = 0; i < noteCount; i += 1) {
    const remarks = String(formData.get(`noteRemarks_${i}`) || "").trim();
    const files = formData
      .getAll(`noteFile_${i}`)
      .filter(
        (f): f is File =>
          f instanceof File &&
          f.size > 0 &&
          f.size <= MAX_UPLOAD_BYTES &&
          isAcceptedUploadType(f.type)
      );
    // An empty note with no attachment is nothing to record.
    if (!remarks && files.length === 0) continue;

    const note = await prisma.employeeNote.create({
      data: { employeeId: employee.id, remarks, createdById: user.id },
    });

    for (const file of files) {
      await prisma.document.create({
        data: {
          employeeId: employee.id,
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
      after: { employeeId: employee.id, remarks, files: files.length },
      userId: user.id,
      userName: user.name,
      branchId,
    });
  }

  revalidatePath("/employees");
  // Back to the roster rather than the new employee's own page — registering
  // is usually one of a batch, so the list is where the next one starts. The
  // id rides along so the list can confirm the save and highlight the row;
  // landing on 200+ unchanged rows otherwise gives no sign it worked.
  // Hosted in a dialog, there's nothing to redirect away from — the caller
  // closes it and refreshes the list underneath.
  if (formData.get("inline") === "1") {
    return { error: null, createdId: employee.id };
  }

  redirect(`/employees?registered=${employee.id}`);
}
