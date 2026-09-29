"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireUserWithBranch, requirePermission } from "@/lib/auth";
import { isOutsideBranch } from "@/lib/branch";
import { refsBelongToBranch } from "@/lib/refScope";
import { MAX_UPLOAD_BYTES } from "@/lib/constants";
import { logAudit } from "@/lib/audit";
import { assertContactsValid } from "@/lib/validators";
import { availableItemStock } from "@/lib/inventoryStock";
import { cellOf, rowError } from "@/lib/bulkImport";
import { nameKey } from "@/lib/partyCode";
import { findClientByName } from "@/lib/entityCode";
import { parseLooseDate } from "@/lib/looseDate";
import type { ImportRowResult } from "@/components/import/report";

// Every nested mutation (documents, trade rates, holidays, contacts,
// inventory) takes a projectId rather than looking the project up itself,
// so this is the one place that guards them all against acting on another
// branch's project.
async function assertProjectInBranch(projectId: string, branchId: string | null, isSuperAdmin: boolean) {
  const project = await prisma.project.findUnique({ where: { id: projectId }, select: { branchId: true } });
  return !!project && !isOutsideBranch(project.branchId, branchId, isSuperAdmin);
}

function dateOrNull(value: FormDataEntryValue | null) {
  const s = String(value || "").trim();
  return s ? new Date(s) : null;
}

function stringOrNull(value: FormDataEntryValue | null) {
  const s = String(value || "").trim();
  return s || null;
}

// A named person on a project needs a reachable phone number. Anything without
// a name is stored blank, so clearing the name clears the contact too.
const PEOPLE = [
  { key: "manager", label: "Project manager" },
  { key: "projectCoordinator", label: "Project coordinator" },
  { key: "salesExecutive", label: "Sales executive" },
] as const;

type PeopleResult = { error: string; data?: undefined } | { error?: undefined; data: Record<string, string | null> };

function readPeople(formData: FormData, keys: readonly string[]): PeopleResult {
  const data: Record<string, string | null> = {};
  for (const p of PEOPLE) {
    if (!keys.includes(p.key)) continue;
    const name = stringOrNull(formData.get(p.key));
    const phone = name ? stringOrNull(formData.get(`${p.key}Phone`)) : null;
    const email = name ? stringOrNull(formData.get(`${p.key}Email`)) : null;
    if (name && (!phone || phone.replace(/\D/g, "").length < 7)) {
      return { error: `Add a phone number for the ${p.label.toLowerCase()}.` };
    }
    if (email && !/^\S+@\S+\.\S+$/.test(email)) {
      return { error: `The ${p.label.toLowerCase()}'s email address isn't valid.` };
    }
    data[p.key] = name;
    data[`${p.key}Phone`] = phone;
    data[`${p.key}Email`] = email;
  }
  return { data };
}

function numberOrNull(value: FormDataEntryValue | null) {
  const s = String(value || "").trim();
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

async function nextProjectCode() {
  const count = await prisma.project.count();
  return `PRJ${String(count + 1).padStart(3, "0")}`;
}

async function nextLpoNumber() {
  const count = await prisma.lpo.count();
  return `LPO-${String(count + 1).padStart(6, "0")}`;
}

export async function createProjectAction(
  _prevState: { error: string | null },
  formData: FormData
): Promise<{ error: string | null }> {
  assertContactsValid(formData);
  const { user, branchId, isSuperAdmin } = await requireUserWithBranch();
  const name = String(formData.get("name") || "").trim();
  const clientId = String(formData.get("clientId") || "");
  if (!name || !clientId) {
    return { error: "Project name and client are required." };
  }
  if (!branchId) {
    return {
      error: isSuperAdmin
        ? "Pick a branch from the switcher before adding a project."
        : "Your account has no branch assigned — contact an admin.",
    };
  }

  if (!(await refsBelongToBranch(branchId, { client: clientId }))) return { error: "Choose one of this branch's clients." };

  const people = readPeople(formData, ["manager"]);
  if (people.error) return { error: people.error };

  const data = {
    code: await nextProjectCode(),
    name,
    clientId,
    branchId,
    description: stringOrNull(formData.get("description")),
    ...people.data,
    timelineStart: dateOrNull(formData.get("timelineStart")),
    timelineEnd: dateOrNull(formData.get("timelineEnd")),
    status: String(formData.get("status") || "PLANNING"),
  };

  const project = await prisma.project.create({ data });

  await logAudit({
    entityType: "PROJECT",
    entityId: project.id,
    action: "CREATE",
    after: data,
    userId: user.id,
    userName: user.name,
    branchId,
  });

  revalidatePath("/projects");
  redirect(`/projects/${project.id}`);
}

// Basic Detail tab. Each tab below saves independently (a real Prisma
// `update` with only that tab's fields) so submitting one tab's form never
// touches — and can't accidentally null out — fields that live on another
// tab's form.
export async function updateProjectAction(formData: FormData): Promise<{ error?: string } | void> {
  assertContactsValid(formData);
  const { user, branchId, isSuperAdmin } = await requireUserWithBranch();
  const id = String(formData.get("projectId") || "");
  if (!id) return;
  if (!(await assertProjectInBranch(id, branchId, isSuperAdmin))) return;

  const people = readPeople(formData, ["manager", "projectCoordinator", "salesExecutive"]);
  if (people.error) return { error: people.error };

  const name = stringOrNull(formData.get("name"));

  const before = await prisma.project.findUnique({ where: { id } });

  // Only a changed client is checked, so a legacy link never blocks an unrelated edit.
  const nextClientId = String(formData.get("clientId") || "");
  if (nextClientId && nextClientId !== before?.clientId && !(await refsBelongToBranch(before?.branchId ?? null, { client: nextClientId }))) {
    return { error: "Choose one of this branch's clients." };
  }

  const data = {
    ...(name ? { name } : {}),
    clientId: nextClientId,
    ...people.data,
    timelineStart: dateOrNull(formData.get("timelineStart")),
    timelineEnd: dateOrNull(formData.get("timelineEnd")),
    status: String(formData.get("status") || "PLANNING"),
    clientProjectNo: stringOrNull(formData.get("clientProjectNo")),
    jobType: stringOrNull(formData.get("jobType")),
    mainContractor: stringOrNull(formData.get("mainContractor")),
    paymentType: stringOrNull(formData.get("paymentType")),
    sponsorshipCompany: stringOrNull(formData.get("sponsorshipCompany")),
    contactNo: stringOrNull(formData.get("contactNo")),
    timesheetCollectionDate: dateOrNull(formData.get("timesheetCollectionDate")),
    noOfEmployeesRequired: formData.get("noOfEmployeesRequired")
      ? Number(formData.get("noOfEmployeesRequired"))
      : null,
    dayShiftStart: stringOrNull(formData.get("dayShiftStart")),
    dayShiftEnd: stringOrNull(formData.get("dayShiftEnd")),
    nightShiftStart: stringOrNull(formData.get("nightShiftStart")),
    nightShiftEnd: stringOrNull(formData.get("nightShiftEnd")),
    interTransfer: formData.get("interTransfer") === "on",
    internalUse: formData.get("internalUse") === "on",
  };

  await prisma.project.update({ where: { id }, data });

  await logAudit({
    entityType: "PROJECT",
    entityId: id,
    action: "UPDATE",
    before: before as unknown as Record<string, unknown>,
    after: data,
    userId: user.id,
    userName: user.name,
    branchId,
  });

  revalidatePath(`/projects/${id}`);
  revalidatePath("/projects");
}

// Location Details tab.
export async function updateProjectLocationAction(formData: FormData) {
  assertContactsValid(formData);
  const { user, branchId, isSuperAdmin } = await requireUserWithBranch();
  const id = String(formData.get("projectId") || "");
  if (!id) return;
  if (!(await assertProjectInBranch(id, branchId, isSuperAdmin))) return;

  const before = await prisma.project.findUnique({ where: { id } });

  const data = {
    address: stringOrNull(formData.get("address")),
    latitude: numberOrNull(formData.get("latitude")),
    longitude: numberOrNull(formData.get("longitude")),
  };

  await prisma.project.update({ where: { id }, data });

  await logAudit({
    entityType: "PROJECT",
    entityId: id,
    action: "UPDATE",
    before: before as unknown as Record<string, unknown>,
    after: data,
    userId: user.id,
    userName: user.name,
    branchId,
  });

  revalidatePath(`/projects/${id}`);
}

// Other Details tab.
export async function updateProjectOtherDetailsAction(formData: FormData) {
  assertContactsValid(formData);
  const { user, branchId, isSuperAdmin } = await requireUserWithBranch();
  const id = String(formData.get("projectId") || "");
  if (!id) return;
  if (!(await assertProjectInBranch(id, branchId, isSuperAdmin))) return;

  const before = await prisma.project.findUnique({ where: { id } });

  const data = {
    description: stringOrNull(formData.get("description")),
  };

  await prisma.project.update({ where: { id }, data });

  await logAudit({
    entityType: "PROJECT",
    entityId: id,
    action: "UPDATE",
    before: before as unknown as Record<string, unknown>,
    after: data,
    userId: user.id,
    userName: user.name,
    branchId,
  });

  revalidatePath(`/projects/${id}`);
}

// --- Documents ---

export async function addProjectDocumentAction(formData: FormData) {
  assertContactsValid(formData);
  const { user, branchId, isSuperAdmin } = await requireUserWithBranch();
  const projectId = String(formData.get("projectId") || "");
  const type = String(formData.get("type") || "OTHER");
  const expiryDate = dateOrNull(formData.get("expiryDate"));
  const file = formData.get("file");
  if (!projectId || !(file instanceof File) || file.size === 0) return;
  if (file.size > MAX_UPLOAD_BYTES) return;
  if (!(await assertProjectInBranch(projectId, branchId, isSuperAdmin))) return;

  const buffer = Buffer.from(await file.arrayBuffer());
  const created = await prisma.projectDocument.create({
    data: {
      projectId,
      type,
      filename: file.name,
      fileData: buffer,
      mimeType: file.type || "application/octet-stream",
      expiryDate,
      uploadedById: user.id,
    },
  });

  await logAudit({
    entityType: "PROJECT_DOCUMENT",
    entityId: created.id,
    action: "CREATE",
    after: { projectId, type, filename: file.name, expiryDate },
    userId: user.id,
    userName: user.name,
    branchId,
  });

  revalidatePath(`/projects/${projectId}`);
}

export async function deleteProjectDocumentAction(formData: FormData) {
  assertContactsValid(formData);
  await requirePermission("projects", "delete");
  const { user, branchId, isSuperAdmin } = await requireUserWithBranch();
  const id = String(formData.get("documentId") || "");
  const projectId = String(formData.get("projectId") || "");
  if (!id) return;
  if (!(await assertProjectInBranch(projectId, branchId, isSuperAdmin))) return;

  const existing = await prisma.projectDocument.findUnique({ where: { id } });
  await prisma.projectDocument.delete({ where: { id } });

  if (existing) {
    await logAudit({
      entityType: "PROJECT_DOCUMENT",
      entityId: id,
      action: "DELETE",
      before: { projectId, type: existing.type, filename: existing.filename, expiryDate: existing.expiryDate },
      userId: user.id,
      userName: user.name,
      branchId,
    });
  }

  revalidatePath(`/projects/${projectId}`);
}

// --- Approved Rates (project-scoped ClientTradeRate) ---

export async function addProjectTradeRateAction(formData: FormData) {
  assertContactsValid(formData);
  const { branchId, isSuperAdmin } = await requireUserWithBranch();
  const projectId = String(formData.get("projectId") || "");
  const clientId = String(formData.get("clientId") || "");
  const trade = String(formData.get("trade") || "").trim();
  const rate = numberOrNull(formData.get("rate"));
  if (!projectId || !clientId || !trade || rate == null) return;
  if (!(await assertProjectInBranch(projectId, branchId, isSuperAdmin))) return;
  const owner = await prisma.project.findUnique({ where: { id: projectId }, select: { branchId: true } });
  if (!(await refsBelongToBranch(owner?.branchId ?? null, { client: clientId }))) return;

  const existing = await prisma.clientTradeRate.findFirst({
    where: { clientId, projectId, trade },
  });
  if (existing) {
    await prisma.clientTradeRate.update({ where: { id: existing.id }, data: { rate } });
  } else {
    await prisma.clientTradeRate.create({ data: { clientId, projectId, trade, rate } });
  }

  revalidatePath(`/projects/${projectId}`);
}

export async function removeProjectTradeRateAction(formData: FormData) {
  assertContactsValid(formData);
  const { branchId, isSuperAdmin } = await requireUserWithBranch();
  const projectId = String(formData.get("projectId") || "");
  const rateId = String(formData.get("rateId") || "");
  if (!rateId) return;
  if (!(await assertProjectInBranch(projectId, branchId, isSuperAdmin))) return;
  await prisma.clientTradeRate.delete({ where: { id: rateId } });
  revalidatePath(`/projects/${projectId}`);
}

// --- Holiday Details ---

export async function addProjectHolidayAction(formData: FormData) {
  assertContactsValid(formData);
  const { branchId, isSuperAdmin } = await requireUserWithBranch();
  const projectId = String(formData.get("projectId") || "");
  const date = dateOrNull(formData.get("date"));
  const label = String(formData.get("label") || "").trim();
  const rateMultiplier = numberOrNull(formData.get("rateMultiplier"));
  if (!projectId || !date || !label) return;
  if (!(await assertProjectInBranch(projectId, branchId, isSuperAdmin))) return;

  await prisma.projectHoliday.upsert({
    where: { projectId_date: { projectId, date } },
    update: { label, rateMultiplier },
    create: { projectId, date, label, rateMultiplier },
  });

  revalidatePath(`/projects/${projectId}`);
}

export async function removeProjectHolidayAction(formData: FormData) {
  assertContactsValid(formData);
  const { branchId, isSuperAdmin } = await requireUserWithBranch();
  const projectId = String(formData.get("projectId") || "");
  const holidayId = String(formData.get("holidayId") || "");
  if (!holidayId) return;
  if (!(await assertProjectInBranch(projectId, branchId, isSuperAdmin))) return;
  await prisma.projectHoliday.delete({ where: { id: holidayId } });
  revalidatePath(`/projects/${projectId}`);
}

// --- Related Users (ProjectContact) ---

export async function addProjectContactAction(formData: FormData) {
  assertContactsValid(formData);
  const { branchId, isSuperAdmin } = await requireUserWithBranch();
  const projectId = String(formData.get("projectId") || "");
  const name = String(formData.get("name") || "").trim();
  if (!projectId || !name) return;
  if (!(await assertProjectInBranch(projectId, branchId, isSuperAdmin))) return;

  await prisma.projectContact.create({
    data: {
      projectId,
      name,
      role: stringOrNull(formData.get("role")),
      phone: stringOrNull(formData.get("phone")),
      email: stringOrNull(formData.get("email")),
    },
  });

  revalidatePath(`/projects/${projectId}`);
}

export async function updateProjectContactAction(formData: FormData) {
  assertContactsValid(formData);
  const { branchId, isSuperAdmin } = await requireUserWithBranch();
  const projectId = String(formData.get("projectId") || "");
  const contactId = String(formData.get("contactId") || "");
  const name = String(formData.get("name") || "").trim();
  if (!contactId || !name) return;
  if (!(await assertProjectInBranch(projectId, branchId, isSuperAdmin))) return;

  await prisma.projectContact.update({
    where: { id: contactId },
    data: {
      name,
      role: stringOrNull(formData.get("role")),
      phone: stringOrNull(formData.get("phone")),
      email: stringOrNull(formData.get("email")),
    },
  });

  revalidatePath(`/projects/${projectId}`);
}

export async function removeProjectContactAction(formData: FormData) {
  assertContactsValid(formData);
  const { branchId, isSuperAdmin } = await requireUserWithBranch();
  const projectId = String(formData.get("projectId") || "");
  const contactId = String(formData.get("contactId") || "");
  if (!contactId) return;
  if (!(await assertProjectInBranch(projectId, branchId, isSuperAdmin))) return;
  await prisma.projectContact.delete({ where: { id: contactId } });
  revalidatePath(`/projects/${projectId}`);
}

// --- Inventory Details ---

export async function addProjectInventoryAction(formData: FormData): Promise<{ error?: string } | void> {
  assertContactsValid(formData);
  const { branchId, isSuperAdmin } = await requireUserWithBranch();
  const projectId = String(formData.get("projectId") || "");
  const itemName = String(formData.get("itemName") || "").trim();
  const quantity = Number(formData.get("quantity")) || 1;
  const assignedDate = dateOrNull(formData.get("assignedDate")) || new Date();
  const condition = stringOrNull(formData.get("condition"));
  if (!projectId || !itemName || !branchId) return;
  if (!(await assertProjectInBranch(projectId, branchId, isSuperAdmin))) return;

  // The item is looked up (and, if new, created) in the PROJECT's branch. An
  // unscoped lookup by name matched another company's item of the same name,
  // attached it to this project, and drew down their stock.
  const projectBranch = (await prisma.project.findUnique({ where: { id: projectId }, select: { branchId: true } }))?.branchId;
  if (!projectBranch) return;
  const existing = await prisma.inventoryItem.findFirst({ where: { name: itemName, branchId: projectBranch }, select: { id: true, variants: { select: { id: true } } } });

  // Only an item that already exists AND is stock-tracked (has at least one
  // variant) gets checked against real stock — a brand-new name typed here,
  // or an existing item nobody has ever recorded stock for, is a free-form
  // equipment log entry, same as before variants/stock existed.
  if (existing && existing.variants.length > 0) {
    const available = await availableItemStock(existing.id);
    if (quantity > available) {
      return { error: `Only ${Math.max(0, available)} of "${itemName}" left in stock.` };
    }
  }

  const item = existing ?? (await prisma.inventoryItem.create({ data: { name: itemName, branchId: projectBranch } }));

  await prisma.projectInventoryAssignment.create({
    data: { projectId, itemId: item.id, quantity, assignedDate, condition },
  });

  revalidatePath(`/projects/${projectId}`);
}

export async function returnProjectInventoryAction(formData: FormData) {
  assertContactsValid(formData);
  const { branchId, isSuperAdmin } = await requireUserWithBranch();
  const projectId = String(formData.get("projectId") || "");
  const assignmentId = String(formData.get("assignmentId") || "");
  if (!assignmentId) return;
  if (!(await assertProjectInBranch(projectId, branchId, isSuperAdmin))) return;
  await prisma.projectInventoryAssignment.update({
    where: { id: assignmentId },
    data: { returnDate: new Date() },
  });
  revalidatePath(`/projects/${projectId}`);
}

export async function removeProjectInventoryAction(formData: FormData) {
  assertContactsValid(formData);
  const { branchId, isSuperAdmin } = await requireUserWithBranch();
  const projectId = String(formData.get("projectId") || "");
  const assignmentId = String(formData.get("assignmentId") || "");
  if (!assignmentId) return;
  if (!(await assertProjectInBranch(projectId, branchId, isSuperAdmin))) return;
  await prisma.projectInventoryAssignment.delete({ where: { id: assignmentId } });
  revalidatePath(`/projects/${projectId}`);
}

export async function deleteProjectAction(formData: FormData) {
  assertContactsValid(formData);
  await requirePermission("projects", "delete");
  const { user, branchId, isSuperAdmin } = await requireUserWithBranch();
  const id = String(formData.get("projectId") || "");
  if (!id) return;

  const target = await prisma.project.findUnique({ where: { id } });
  if (!target || isOutsideBranch(target.branchId, branchId, isSuperAdmin)) return;

  // Timesheet rows and attendance keep a nullable link to their project, so
  // deleting one doesn't fail — it quietly blanks the project on billing
  // history that was already invoiced. LPOs point at a project outright and
  // would raise a raw foreign-key error. Both are refused with a reason.
  const [entryCount, lpoCount, attendanceCount] = await Promise.all([
    prisma.timesheetEntry.count({ where: { projectId: id } }),
    prisma.lpo.count({ where: { projectId: id } }),
    prisma.attendance.count({ where: { projectId: id } }),
  ]);
  if (entryCount > 0 || lpoCount > 0 || attendanceCount > 0) {
    const parts: string[] = [];
    if (entryCount > 0) parts.push(`${entryCount} timesheet row(s)`);
    if (lpoCount > 0) parts.push(`${lpoCount} LPO(s)`);
    if (attendanceCount > 0) parts.push(`${attendanceCount} attendance record(s)`);
    redirect(
      `/projects?error=${encodeURIComponent(
        `Can't delete "${target.name}" — still linked to ${parts.join(", ")}.`
      )}`
    );
  }

  // Unassigning employees is a soft, reversible consequence -- unlike the
  // timesheet history checked above, it's safe to do automatically
  // rather than blocking the delete.
  await prisma.employee.updateMany({
    where: { projectId: id },
    data: { projectId: null },
  });
  await prisma.project.delete({ where: { id } });

  await logAudit({
    entityType: "PROJECT",
    entityId: id,
    action: "DELETE",
    before: target as unknown as Record<string, unknown>,
    userId: user.id,
    userName: user.name,
    branchId,
  });

  revalidatePath("/projects");
  revalidatePath("/employees");
  redirect("/projects");
}

// --- Sites (child of Project — a Project can have multiple physical sites) ---

export async function createSiteAction(formData: FormData) {
  assertContactsValid(formData);
  const { user, branchId, isSuperAdmin } = await requireUserWithBranch();
  const projectId = String(formData.get("projectId") || "");
  const name = String(formData.get("name") || "").trim();
  if (!projectId || !name) return;
  if (!(await assertProjectInBranch(projectId, branchId, isSuperAdmin))) return;

  const site = await prisma.site.create({
    data: {
      projectId,
      name,
      address: stringOrNull(formData.get("address")),
    },
  });

  await logAudit({
    entityType: "SITE",
    entityId: site.id,
    action: "CREATE",
    after: { projectId, name, address: site.address },
    userId: user.id,
    userName: user.name,
    branchId,
  });

  revalidatePath(`/projects/${projectId}`);
}

// --- LPOs (a Project can have more than one over its lifetime) ---

export async function addLpoAction(formData: FormData) {
  assertContactsValid(formData);
  const { user, branchId, isSuperAdmin } = await requireUserWithBranch();
  const projectId = String(formData.get("projectId") || "");
  const clientId = String(formData.get("clientId") || "");
  if (!projectId || !clientId || !branchId) return;
  if (!(await assertProjectInBranch(projectId, branchId, isSuperAdmin))) return;
  if (!(await refsBelongToBranch(branchId, { client: clientId }))) return;

  const lpoNumber = await nextLpoNumber();
  const data = {
    lpoNumber,
    projectId,
    clientId,
    branchId,
    value: numberOrNull(formData.get("value")),
    quantity: numberOrNull(formData.get("quantity")),
    trade: stringOrNull(formData.get("trade")),
    rate: numberOrNull(formData.get("rate")),
    validFrom: dateOrNull(formData.get("validFrom")),
    validTo: dateOrNull(formData.get("validTo")),
    notes: stringOrNull(formData.get("notes")),
  };

  const lpo = await prisma.lpo.create({ data });

  await logAudit({
    entityType: "LPO",
    entityId: lpo.id,
    action: "CREATE",
    after: data,
    userId: user.id,
    userName: user.name,
    branchId,
  });

  revalidatePath(`/projects/${projectId}`);
}

export async function updateLpoAction(formData: FormData) {
  assertContactsValid(formData);
  const { user, branchId, isSuperAdmin } = await requireUserWithBranch();
  const projectId = String(formData.get("projectId") || "");
  const lpoId = String(formData.get("lpoId") || "");
  if (!lpoId) return;
  if (!(await assertProjectInBranch(projectId, branchId, isSuperAdmin))) return;

  const before = await prisma.lpo.findUnique({ where: { id: lpoId } });
  if (!before || before.projectId !== projectId) return;

  const data = {
    value: numberOrNull(formData.get("value")),
    quantity: numberOrNull(formData.get("quantity")),
    trade: stringOrNull(formData.get("trade")),
    rate: numberOrNull(formData.get("rate")),
    validFrom: dateOrNull(formData.get("validFrom")),
    validTo: dateOrNull(formData.get("validTo")),
    billedAmount: numberOrNull(formData.get("billedAmount")) ?? before.billedAmount,
    notes: stringOrNull(formData.get("notes")),
  };

  await prisma.lpo.update({ where: { id: lpoId }, data });

  await logAudit({
    entityType: "LPO",
    entityId: lpoId,
    action: "UPDATE",
    before: before as unknown as Record<string, unknown>,
    after: data,
    userId: user.id,
    userName: user.name,
    branchId,
  });

  revalidatePath(`/projects/${projectId}`);
}

export async function closeLpoAction(formData: FormData) {
  assertContactsValid(formData);
  const { user, branchId, isSuperAdmin } = await requireUserWithBranch();
  const projectId = String(formData.get("projectId") || "");
  const lpoId = String(formData.get("lpoId") || "");
  if (!lpoId) return;
  if (!(await assertProjectInBranch(projectId, branchId, isSuperAdmin))) return;

  const before = await prisma.lpo.findUnique({ where: { id: lpoId } });
  if (!before || before.projectId !== projectId) return;

  await prisma.lpo.update({ where: { id: lpoId }, data: { status: "CLOSED" } });

  await logAudit({
    entityType: "LPO",
    entityId: lpoId,
    action: "UPDATE",
    before: { status: before.status },
    after: { status: "CLOSED" },
    userId: user.id,
    userName: user.name,
    branchId,
  });

  revalidatePath(`/projects/${projectId}`);
}

export async function deleteSiteAction(formData: FormData) {
  assertContactsValid(formData);
  await requirePermission("projects", "delete");
  const { user, branchId, isSuperAdmin } = await requireUserWithBranch();
  const projectId = String(formData.get("projectId") || "");
  const siteId = String(formData.get("siteId") || "");
  if (!siteId) return;
  if (!(await assertProjectInBranch(projectId, branchId, isSuperAdmin))) return;

  const existing = await prisma.site.findUnique({ where: { id: siteId } });
  await prisma.site.delete({ where: { id: siteId } });

  if (existing) {
    await logAudit({
      entityType: "SITE",
      entityId: siteId,
      action: "DELETE",
      before: { projectId, name: existing.name, address: existing.address },
      userId: user.id,
      userName: user.name,
      branchId,
    });
  }

  revalidatePath(`/projects/${projectId}`);
}

const PROJECT_STATUSES = ["PLANNING", "ACTIVE", "COMPLETED", "ON_HOLD"];

/**
 * Bulk add/update projects. A project is matched by its code, else by name
 * (ignoring case and spacing) within this company; the client must already
 * exist. Empty cells leave saved values alone.
 */
export async function bulkImportProjectsAction(rows: Record<string, string>[]): Promise<ImportRowResult[]> {
  await requirePermission("projects", "create");
  const { user, branchId, isSuperAdmin } = await requireUserWithBranch();
  if (!branchId) {
    const message = isSuperAdmin ? "Pick a branch from the switcher before importing." : "Your account has no branch assigned — contact an admin.";
    return rows.map((_, i) => rowError(i, undefined, message));
  }
  const existingProjects = await prisma.project.findMany({ where: { branchId } });
  const byCode = new Map(existingProjects.map((p) => [p.code.toLowerCase(), p]));
  const byName = new Map(existingProjects.map((p) => [nameKey(p.name), p]));
  let codeCounter = await prisma.project.count();
  const takenCodes = new Set((await prisma.project.findMany({ select: { code: true } })).map((p) => p.code.toLowerCase()));
  const nextCode = () => {
    do codeCounter++; while (takenCodes.has(`prj${String(codeCounter).padStart(3, "0")}`));
    const code = `PRJ${String(codeCounter).padStart(3, "0")}`;
    takenCodes.add(code.toLowerCase());
    return code;
  };
  const results: ImportRowResult[] = [];

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const name = cellOf(r, "Project name");
    if (!name) { results.push(rowError(i, undefined, "Project name is required.")); continue; }
    try {
      const notes: NonNullable<ImportRowResult["notes"]> = [];
      const codeCell = cellOf(r, "Code").toUpperCase();
      const existing = (codeCell && byCode.get(codeCell.toLowerCase())) || byName.get(nameKey(name)) || null;
      if (codeCell && !existing && takenCodes.has(codeCell.toLowerCase())) {
        results.push(rowError(i, name, `The code ${codeCell} belongs to another project.`));
        continue;
      }

      const clientName = cellOf(r, "Client");
      let clientId: string | undefined;
      if (clientName) {
        const client = await findClientByName(clientName, branchId);
        if (!client) { results.push(rowError(i, name, `Client "${clientName}" isn't in your clients yet. Add it (or import your clients) first.`)); continue; }
        clientId = client.id;
      } else if (!existing) {
        results.push(rowError(i, name, "Client is required for a new project."));
        continue;
      }

      const data: Record<string, string | number | Date | null> = {};
      const put = (label: string, key: string) => { const v = cellOf(r, label); if (v) data[key] = v; };
      put("Description", "description"); put("Address", "address");
      put("Project manager", "manager"); put("Manager phone", "managerPhone"); put("Manager email", "managerEmail");
      put("Coordinator", "projectCoordinator"); put("Coordinator phone", "projectCoordinatorPhone");
      put("Sales executive", "salesExecutive"); put("Sales executive phone", "salesExecutivePhone");

      const statusRaw = cellOf(r, "Status");
      if (statusRaw) {
        const status = statusRaw.toUpperCase().replace(/[\s-]+/g, "_");
        if (PROJECT_STATUSES.includes(status)) data.status = status;
        else notes.push({ tone: "warn", title: `Status "${statusRaw}" isn't recognised`, detail: "Use Planning, Active, Completed or On hold. That field was skipped." });
      }
      for (const [label, key] of [["Start date", "timelineStart"], ["End date", "timelineEnd"]] as const) {
        const raw = cellOf(r, label);
        if (!raw) continue;
        const d = parseLooseDate(raw);
        if (d === "invalid") notes.push({ tone: "warn", title: `${label} "${raw}" isn't a date`, detail: "Use day/month/year, e.g. 25/12/2026. That field was skipped." });
        else if (d) data[key] = d;
      }
      const reqRaw = cellOf(r, "Workers required");
      if (reqRaw) {
        const n = Number(reqRaw.replace(/,/g, ""));
        if (Number.isFinite(n) && n >= 0) data.noOfEmployeesRequired = Math.trunc(n);
        else notes.push({ tone: "warn", title: `Workers required "${reqRaw}" isn't a number`, detail: "That field was skipped." });
      }
      if (data.manager && !data.managerPhone && !(existing?.managerPhone)) notes.push({ tone: "info", title: "Project manager has no phone number", detail: "Add one on the project's page so they can be reached." });
      const email = data.managerEmail;
      if (typeof email === "string" && !/^\S+@\S+\.\S+$/.test(email)) { delete data.managerEmail; notes.push({ tone: "warn", title: `Manager email "${email}" isn't valid`, detail: "That field was skipped." }); }

      if (existing) {
        const changes = { ...data, ...(clientId && clientId !== existing.clientId ? { clientId } : {}), ...(name !== existing.name ? { name } : {}) };
        await prisma.project.update({ where: { id: existing.id }, data: changes });
        await logAudit({ entityType: "PROJECT", entityId: existing.id, action: "UPDATE", before: existing as unknown as Record<string, unknown>, after: changes, userId: user.id, userName: user.name, branchId });
        Object.assign(existing, changes);
        results.push({ row: i + 2, name, status: "updated", notes });
      } else {
        const code = codeCell || nextCode();
        takenCodes.add(code.toLowerCase());
        const created = await prisma.project.create({ data: { code, name, clientId: clientId!, branchId, status: "PLANNING", ...data } as never });
        await logAudit({ entityType: "PROJECT", entityId: created.id, action: "CREATE", after: { code, name, clientId, ...data }, userId: user.id, userName: user.name, branchId });
        byCode.set(code.toLowerCase(), created);
        byName.set(nameKey(name), created);
        results.push({ row: i + 2, name, status: "created", notes });
      }
    } catch (e) {
      results.push(rowError(i, name, e instanceof Error ? e.message : "Failed to import row."));
    }
  }
  revalidatePath("/projects");
  return results;
}
