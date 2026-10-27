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
import { requestProjectAssignment } from "@/lib/projectAssignment";
import { BLOOD_GROUPS } from "./quick-view-fields";
import { TRADES } from "@/lib/trades";
import { getOrCreateSkill } from "@/lib/skillScope";
import { DEFAULT_SKILL_LEVEL } from "@/lib/skillLevel";
import { normalizeNationality } from "@/lib/nationality";
import { normalizePhone } from "@/lib/phone";
import { formatMasked } from "@/lib/idFormats";
import type { ExtractedDocumentFields } from "@/app/api/documents/extract/route";

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
  laborCardNumber: string | null;
  laborCardPersonalNo: string | null;
  visaNumber: string | null;
  unifiedNo: string | null;
  payStructure: string | null;
  skills: { id: string; name: string; level: number | null; rate: number | null }[];
  dateOfBirth: string | null;
  joinDate: string | null;
  expiry: { visaExpiry: string | null; laborCardExpiry: string | null; medicalExpiry: string | null; passportExpiry: string | null; emiratesIdExpiry: string | null };
  docs: { id: string; type: string; filename: string; expiryDate: string | null }[];
  projects: { id: string; name: string }[];
  canEdit: boolean;
  canViewPay: boolean;
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
        skills: { select: { skillId: true, proficiencyPercent: true, rate: true, skill: { select: { name: true } } }, orderBy: { skillId: "asc" } },
      },
    }),
    prisma.project.findMany({ where: branchWhere(branchId), select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);
  if (!e || isOutsideBranch(e.branchId, branchId, isSuperAdmin)) return null;
  const viewPay = can(subjectOf(user), "payroll", "view");
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
    laborCardNumber: e.laborCardNumber,
    laborCardPersonalNo: e.laborCardPersonalNo,
    visaNumber: e.visaNumber,
    unifiedNo: e.unifiedNo,
    payStructure: viewPay ? e.payStructure : null,
    skills: e.skills.map((k) => ({ id: k.skillId, name: k.skill.name, level: k.proficiencyPercent ?? DEFAULT_SKILL_LEVEL, rate: viewPay && k.rate != null ? Number(k.rate.toString()) : null })),
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
    canViewPay: viewPay,
  };
}

const TEXT = new Set(["name", "mobileNumber", "passportNumber", "emiratesId", "nationality", "gender", "bloodGroup", "laborCardNumber", "laborCardPersonalNo", "visaNumber", "unifiedNo", "position", "department"]);
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
  if (!before || isOutsideBranch(before.branchId, branchId, isSuperAdmin)) return { error: "That employee isn't in this company." };

  const raw = (input.value ?? "").trim();
  let value: string | Date | null = raw || null;

  if ((field === "position" || field === "department") && before.category !== "STAFF") return { error: "Site staff's trade is changed from Trade, not Position." };
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
      if (value !== before.projectId && !(await refsBelongToBranch(before.branchId, { supplier: [], project: value as string, vehicle: null }))) return { error: "That project isn't part of this company." };
      if (value !== before.projectId && before.supplierId) {
        const s = await prisma.supplier.findUnique({ where: { id: before.supplierId }, select: { approvalStatus: true } });
        if (s && s.approvalStatus !== "Approved") return { error: "This supplier isn't approved yet. Approve it before assigning its employees to a project." };
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

  // Picking a project is held for approval (see the profile form): the worker keeps their project until it is approved.
  if (field === "projectId" && value && value !== before.projectId) {
    const { projectName } = await requestProjectAssignment({ employeeId: id, projectId: value as string, siteId: null, by: { id: user.id, name: user.name }, branchId });
    revalidatePath("/approvals");
    return { error: `Sent for approval. ${before.name} moves to ${projectName} once it is approved.` };
  }

  const data: Record<string, unknown> = { [field]: value };
  // Office staff have a designation instead of a trade; the profile form keeps the two columns in step the same way.
  if (field === "position") data.trade = null;
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


export type ScanResult = {
  applied: { key: string; label: string; value: string }[];
  /** The scan disagrees with what's on the profile: shown for the person to choose, never overwritten. */
  conflicts: { key: string; label: string; current: string; scan: string }[];
};

type ScanSpec = { key: keyof ExtractedDocumentFields & string; label: string; kind: "text" | "passport" | "eid" | "date" | "country" | "gender" | "phone"; renewable?: boolean };
const SCAN_FIELDS: ScanSpec[] = [
  { key: "passportNumber", label: "Passport number", kind: "passport" },
  { key: "passportExpiry", label: "Passport expiry", kind: "date", renewable: true },
  { key: "emiratesId", label: "Emirates ID", kind: "eid" },
  { key: "emiratesIdExpiry", label: "Emirates ID expiry", kind: "date", renewable: true },
  { key: "laborCardNumber", label: "Labour card number", kind: "text" },
  { key: "laborCardPersonalNo", label: "Labour card personal no.", kind: "text" },
  { key: "laborCardExpiry", label: "Labour card expiry", kind: "date", renewable: true },
  { key: "visaNumber", label: "Visa / residency file no.", kind: "text" },
  { key: "visaExpiry", label: "Visa expiry", kind: "date", renewable: true },
  { key: "unifiedNo", label: "Unified number", kind: "text" },
  { key: "dateOfBirth", label: "Date of birth", kind: "date" },
  { key: "nationality", label: "Nationality", kind: "country" },
  { key: "gender", label: "Gender", kind: "gender" },
  { key: "mobileNumber", label: "Mobile number", kind: "phone" },
];

function readScanValue(kind: ScanSpec["kind"], raw: unknown): string | null {
  const text = typeof raw === "string" ? raw.trim() : "";
  if (!text) return null;
  switch (kind) {
    case "date":
      return /^\d{4}-\d{2}-\d{2}$/.test(text) && !Number.isNaN(new Date(text).getTime()) ? text : null;
    case "eid":
      return text.replace(/\D/g, "").length === 15 ? formatMasked("eid", text) : null;
    case "passport":
      return formatMasked("passport", text) || null;
    case "country":
      return normalizeNationality(text).value;
    case "gender": {
      const g = text.toUpperCase();
      return g === "M" || g === "MALE" ? "MALE" : g === "F" || g === "FEMALE" ? "FEMALE" : null;
    }
    case "phone":
      return normalizePhone(text);
    default:
      return text;
  }
}

/**
 * Puts everything read from a scan onto the profile. What is empty is filled; a
 * renewed expiry replaces an older one; anything else that disagrees with what
 * is already there is handed back as a conflict rather than overwritten. Values
 * that fail their own format check (a 14-digit Emirates ID, an unknown country)
 * count as not read, so a misread never lands on the record.
 */
export async function applyScanAction(input: { id: string; fields: ExtractedDocumentFields }): Promise<ScanResult | { error: string }> {
  const { user, branchId, isSuperAdmin } = await requireUserWithBranch();
  if (!can(subjectOf(user), "workforce", "edit")) return { error: "You don't have permission to edit employees." };
  const before = await prisma.employee.findUnique({ where: { id: input.id } });
  if (!before || isOutsideBranch(before.branchId, branchId, isSuperAdmin)) return { error: "That employee isn't in this company." };

  const result: ScanResult = { applied: [], conflicts: [] };
  const data: Record<string, unknown> = {};
  const was: Record<string, unknown> = {};
  for (const spec of SCAN_FIELDS) {
    const scan = readScanValue(spec.kind, input.fields[spec.key]);
    if (!scan) continue;
    const cur = (before as Record<string, unknown>)[spec.key];
    const current = cur instanceof Date ? iso(cur) : ((cur as string | null) ?? null);
    if (!current) {
      data[spec.key] = spec.kind === "date" ? new Date(scan) : scan;
      was[spec.key] = cur ?? null;
      result.applied.push({ key: spec.key, label: spec.label, value: scan });
    } else if (current === scan || (spec.kind !== "date" && current.replace(/\W/g, "").toUpperCase() === scan.replace(/\W/g, "").toUpperCase())) {
      continue;
    } else if (spec.kind === "date" && spec.renewable) {
      if (scan > current) {
        data[spec.key] = new Date(scan);
        was[spec.key] = cur;
        result.applied.push({ key: spec.key, label: spec.label, value: scan });
      } // an older expiry than the one on file is an old scan: leave the newer date alone
    } else {
      result.conflicts.push({ key: spec.key, label: spec.label, current, scan });
    }
  }
  if (result.applied.length === 0) return result;

  await prisma.employee.update({ where: { id: input.id }, data });
  await logAudit({
    entityType: "EMPLOYEE",
    entityId: input.id,
    action: "UPDATE",
    before: was,
    after: data,
    userId: user.id,
    userName: user.name,
    branchId,
  });
  revalidatePath(`/employees/${input.id}`);
  revalidatePath("/employees");
  return result;
}

/**
 * Changes a site worker's trade. The trade is their first known trade, so the
 * chosen one is added to Known Trade Details if it isn't there (keeping any
 * level and rate already recorded) and made the worker's trade.
 */
export async function setEmployeeTradeAction(input: { id: string; trade: string }): Promise<{ ok: true } | { error: string }> {
  const { user, branchId, isSuperAdmin } = await requireUserWithBranch();
  if (!can(subjectOf(user), "workforce", "edit")) return { error: "You don't have permission to edit employees." };
  const before = await prisma.employee.findUnique({ where: { id: input.id }, select: { id: true, branchId: true, category: true, trade: true, position: true, skills: { select: { skill: { select: { name: true } } } } } });
  if (!before || isOutsideBranch(before.branchId, branchId, isSuperAdmin)) return { error: "That employee isn't in this company." };
  if (before.category === "STAFF") return { error: "Office staff have a position, not a trade." };
  const name = input.trade.trim();
  const known = before.skills.some((k) => k.skill.name.toLowerCase() === name.toLowerCase());
  if (!name || (!(TRADES as readonly string[]).includes(name) && !known)) return { error: "Choose a trade from the list." };

  const skill = await getOrCreateSkill(name, before.branchId);
  await prisma.employeeSkill.upsert({
    where: { employeeId_skillId: { employeeId: input.id, skillId: skill.id } },
    update: {},
    create: { employeeId: input.id, skillId: skill.id, proficiencyPercent: DEFAULT_SKILL_LEVEL, rate: null },
  });
  await prisma.employee.update({ where: { id: input.id }, data: { trade: skill.name, position: skill.name } });
  await logAudit({
    entityType: "EMPLOYEE",
    entityId: input.id,
    action: "UPDATE",
    before: { trade: before.trade, position: before.position },
    after: { trade: skill.name, position: skill.name },
    userId: user.id,
    userName: user.name,
    branchId,
  });
  revalidatePath(`/employees/${input.id}`);
  revalidatePath("/employees");
  revalidatePath("/trades");
  return { ok: true };
}
