"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireUserWithBranch, subjectOf } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { branchWhere, isOutsideBranch } from "@/lib/branch";
import { refsBelongToBranch } from "@/lib/refScope";
import { logAudit } from "@/lib/audit";
import { assertContactsValid } from "@/lib/validators";
import { checkEmployee } from "@/lib/dataChecks";
import { employeeDuplicates } from "@/lib/duplicateCheck";
import { recordProjectChange } from "@/lib/employeeAssignment";
import { BLOOD_GROUPS } from "./quick-view-fields";

/**
 * The employee quick view: one worker's most-used details, and a save that
 * changes one field at a time. The full profile form posts every field at once
 * (and blanks any it doesn't carry), so it can't be reused for this — instead a
 * short allow-list of fields is saved here, each through the same checks the
 * form applies.
 */

const iso = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : null);

export type QuickView = {
  id: string;
  name: string;
  employeeIdNo: string;
  category: "STAFF" | "SITE_STAFF";
  hasPhoto: boolean;
  active: boolean;
  status: string;
  trade: string | null;
  position: string | null;
  department: string | null;
  camp: string | null;
  projectId: string | null;
  projectName: string | null;
  nationality: string | null;
  gender: string | null;
  bloodGroup: string | null;
  mobileNumber: string | null;
  passportNumber: string | null;
  emiratesId: string | null;
  dateOfBirth: string | null;
  joinDate: string | null;
  expiry: { visaExpiry: string | null; laborCardExpiry: string | null; medicalExpiry: string | null; passportExpiry: string | null; emiratesIdExpiry: string | null };
  docs: { id: string; type: string; filename: string; expiryDate: string | null }[];
  projects: { id: string; name: string }[];
  canEdit: boolean;
};

export async function loadQuickViewAction(id: string): Promise<QuickView | null> {
  const { user, branchId, isSuperAdmin } = await requireUserWithBranch();
  const [e, projects] = await Promise.all([
    prisma.employee.findUnique({
      where: { id },
      omit: { photoData: true },
      include: {
        project: { select: { name: true } },
        documents: { select: { id: true, type: true, filename: true, expiryDate: true }, orderBy: { uploadedAt: "desc" } },
        bed: { select: { label: true, room: { select: { name: true, camp: { select: { name: true } } } } } },
      },
    }),
    prisma.project.findMany({ where: branchWhere(branchId), select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);
  if (!e || isOutsideBranch(e.branchId, branchId, isSuperAdmin)) return null;
  return {
    id: e.id,
    name: e.name,
    employeeIdNo: e.employeeIdNo,
    category: e.category,
    hasPhoto: !!e.photoMimeType,
    active: e.active,
    status: e.status,
    trade: e.trade,
    position: e.position,
    department: e.department,
    camp: e.bed ? `${e.bed.room.camp.name} · ${e.bed.room.name} · ${e.bed.label}` : null,
    projectId: e.projectId,
    projectName: e.project?.name ?? null,
    nationality: e.nationality,
    gender: e.gender,
    bloodGroup: e.bloodGroup,
    mobileNumber: e.mobileNumber,
    passportNumber: e.passportNumber,
    emiratesId: e.emiratesId,
    dateOfBirth: iso(e.dateOfBirth),
    joinDate: iso(e.joinDate),
    expiry: {
      visaExpiry: iso(e.visaExpiry),
      laborCardExpiry: iso(e.laborCardExpiry),
      medicalExpiry: iso(e.medicalExpiry),
      passportExpiry: iso(e.passportExpiry),
      emiratesIdExpiry: iso(e.emiratesIdExpiry),
    },
    docs: e.documents.map((d) => ({ id: d.id, type: d.type, filename: d.filename, expiryDate: iso(d.expiryDate) })),
    projects,
    canEdit: can(subjectOf(user), "workforce", "edit"),
  };
}

const TEXT = new Set(["name", "mobileNumber", "passportNumber", "emiratesId", "nationality", "gender", "bloodGroup"]);
const DATES = new Set(["dateOfBirth", "joinDate", "visaExpiry", "laborCardExpiry", "medicalExpiry", "passportExpiry", "emiratesIdExpiry"]);
const FIELDS = new Set([...TEXT, ...DATES, "projectId"]);

export type SaveResult = { ok: true; value: string | null; previous: string | null } | { ok?: false; error?: string; warnings?: string[] };

/**
 * Saves one allow-listed field. `confirm` skips the "check this" warnings (a
 * likely typo or duplicate) once the person has seen them.
 */
export async function saveEmployeeFieldAction(input: { id: string; field: string; value: string | null; confirm?: boolean }): Promise<SaveResult> {
  const { user, branchId, isSuperAdmin } = await requireUserWithBranch();
  if (!can(subjectOf(user), "workforce", "edit")) return { error: "You don't have permission to edit employees." };
  const { id, field } = input;
  if (!FIELDS.has(field)) return { error: "That field can't be edited here." };
  const before = await prisma.employee.findUnique({ where: { id } });
  if (!before || isOutsideBranch(before.branchId, branchId, isSuperAdmin)) return { error: "That employee isn't in this branch." };

  const raw = (input.value ?? "").trim();
  let value: string | Date | null = raw || null;

  if (field === "name" && !raw) return { error: "Name can't be empty." };
  if (field === "gender" && value && !["MALE", "FEMALE"].includes(value as string)) return { error: "Choose male or female." };
  if (field === "bloodGroup" && value && !(BLOOD_GROUPS as readonly string[]).includes(value as string)) return { error: "Choose a valid blood group." };
  if (DATES.has(field) && value) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value as string) || Number.isNaN(new Date(value as string).getTime())) return { error: "Enter a valid date." };
    value = new Date(value as string);
  }

  // Phone numbers and identity numbers get the same checks the profile form runs.
  try {
    const f = new FormData();
    if (typeof value === "string") f.set(field, value);
    assertContactsValid(f);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "That value isn't valid." };
  }

  if (field === "projectId") {
    if (value) {
      if (value !== before.projectId && !(await refsBelongToBranch(before.branchId, { supplier: [], project: value as string, vehicle: null }))) return { error: "That project isn't part of this branch." };
      if (value !== before.projectId && before.supplierId) {
        const s = await prisma.supplier.findUnique({ where: { id: before.supplierId }, select: { approvalStatus: true } });
        if (s && s.approvalStatus !== "Approved") return { error: "This supplier isn't approved yet — approve it before assigning its employees to a project." };
      }
    }
  }

  if (!input.confirm) {
    const nextFacts = { emiratesId: before.emiratesId, passportNumber: before.passportNumber, mobileNumber: before.mobileNumber, dateOfBirth: before.dateOfBirth, joinDate: before.joinDate, passportExpiry: before.passportExpiry, emiratesIdExpiry: before.emiratesIdExpiry, laborCardExpiry: before.laborCardExpiry, visaExpiry: before.visaExpiry, medicalExpiry: before.medicalExpiry };
    const wasFacts = { ...nextFacts };
    (nextFacts as Record<string, unknown>)[field] = value;
    const dups =
      field === "emiratesId" || field === "passportNumber" || field === "mobileNumber"
        ? await employeeDuplicates({ [field]: value as string | null, excludeId: id })
        : [];
    const warnings = [...checkEmployee(nextFacts, wasFacts), ...dups];
    if (warnings.length > 0) return { warnings };
  }

  const data: Record<string, unknown> = { [field]: value };
  // A site belongs to one project, so changing the project clears a site left over from the old one.
  if (field === "projectId") data.siteId = null;
  await prisma.employee.update({ where: { id }, data });
  if (field === "projectId") await recordProjectChange(before, (value as string | null) ?? null);

  const prev = (before as Record<string, unknown>)[field];
  await logAudit({
    entityType: "EMPLOYEE",
    entityId: id,
    action: "UPDATE",
    before: { [field]: prev },
    after: { [field]: value },
    userId: user.id,
    userName: user.name,
    branchId,
  });
  revalidatePath(`/employees/${id}`);
  revalidatePath("/employees");
  if (field === "projectId") revalidatePath("/demand/site-arrival");
  const out = (v: unknown) => (v instanceof Date ? iso(v) : ((v as string | null) ?? null));
  return { ok: true, value: out(value), previous: out(prev) };
}

