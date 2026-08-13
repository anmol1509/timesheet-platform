"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireUserWithBranch } from "@/lib/auth";
import { isOutsideBranch } from "@/lib/branch";
import { MAX_UPLOAD_BYTES } from "@/lib/constants";
import { logAudit } from "@/lib/audit";

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

export async function createProjectAction(
  _prevState: { error: string | null },
  formData: FormData
): Promise<{ error: string | null }> {
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

  const data = {
    code: await nextProjectCode(),
    name,
    clientId,
    branchId,
    description: stringOrNull(formData.get("description")),
    manager: stringOrNull(formData.get("manager")),
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
export async function updateProjectAction(formData: FormData) {
  const { user, branchId, isSuperAdmin } = await requireUserWithBranch();
  const id = String(formData.get("projectId") || "");
  if (!id) return;
  if (!(await assertProjectInBranch(id, branchId, isSuperAdmin))) return;

  const name = stringOrNull(formData.get("name"));

  const before = await prisma.project.findUnique({ where: { id } });

  const data = {
    ...(name ? { name } : {}),
    clientId: String(formData.get("clientId") || ""),
    manager: stringOrNull(formData.get("manager")),
    projectCoordinator: stringOrNull(formData.get("projectCoordinator")),
    timelineStart: dateOrNull(formData.get("timelineStart")),
    timelineEnd: dateOrNull(formData.get("timelineEnd")),
    status: String(formData.get("status") || "PLANNING"),
    clientProjectNo: stringOrNull(formData.get("clientProjectNo")),
    jobType: stringOrNull(formData.get("jobType")),
    mainContractor: stringOrNull(formData.get("mainContractor")),
    paymentType: stringOrNull(formData.get("paymentType")),
    lpoNo: stringOrNull(formData.get("lpoNo")),
    lpoDate: dateOrNull(formData.get("lpoDate")),
    closedLpo: formData.get("closedLpo") === "on",
    sponsorshipCompany: stringOrNull(formData.get("sponsorshipCompany")),
    salesExecutive: stringOrNull(formData.get("salesExecutive")),
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
  const { branchId, isSuperAdmin } = await requireUserWithBranch();
  const projectId = String(formData.get("projectId") || "");
  const clientId = String(formData.get("clientId") || "");
  const trade = String(formData.get("trade") || "").trim();
  const rate = numberOrNull(formData.get("rate"));
  if (!projectId || !clientId || !trade || rate == null) return;
  if (!(await assertProjectInBranch(projectId, branchId, isSuperAdmin))) return;

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
  const { branchId, isSuperAdmin } = await requireUserWithBranch();
  const projectId = String(formData.get("projectId") || "");
  const contactId = String(formData.get("contactId") || "");
  if (!contactId) return;
  if (!(await assertProjectInBranch(projectId, branchId, isSuperAdmin))) return;
  await prisma.projectContact.delete({ where: { id: contactId } });
  revalidatePath(`/projects/${projectId}`);
}

// --- Inventory Details ---

export async function addProjectInventoryAction(formData: FormData) {
  const { branchId, isSuperAdmin } = await requireUserWithBranch();
  const projectId = String(formData.get("projectId") || "");
  const itemName = String(formData.get("itemName") || "").trim();
  const quantity = Number(formData.get("quantity")) || 1;
  const assignedDate = dateOrNull(formData.get("assignedDate")) || new Date();
  const condition = stringOrNull(formData.get("condition"));
  if (!projectId || !itemName || !branchId) return;
  if (!(await assertProjectInBranch(projectId, branchId, isSuperAdmin))) return;

  const item = await prisma.inventoryItem.upsert({
    where: { name: itemName },
    update: {},
    create: { name: itemName, branchId },
  });

  await prisma.projectInventoryAssignment.create({
    data: { projectId, itemId: item.id, quantity, assignedDate, condition },
  });

  revalidatePath(`/projects/${projectId}`);
}

export async function returnProjectInventoryAction(formData: FormData) {
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
  const { branchId, isSuperAdmin } = await requireUserWithBranch();
  const projectId = String(formData.get("projectId") || "");
  const assignmentId = String(formData.get("assignmentId") || "");
  if (!assignmentId) return;
  if (!(await assertProjectInBranch(projectId, branchId, isSuperAdmin))) return;
  await prisma.projectInventoryAssignment.delete({ where: { id: assignmentId } });
  revalidatePath(`/projects/${projectId}`);
}

export async function deleteProjectAction(formData: FormData) {
  const { user, branchId, isSuperAdmin } = await requireUserWithBranch();
  const id = String(formData.get("projectId") || "");
  if (!id) return;

  const target = await prisma.project.findUnique({ where: { id } });
  if (!target || isOutsideBranch(target.branchId, branchId, isSuperAdmin)) return;

  // Unassigning employees is a soft, reversible consequence -- unlike a
  // Client with real timesheet history, it's safe to do automatically
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

export async function deleteSiteAction(formData: FormData) {
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
