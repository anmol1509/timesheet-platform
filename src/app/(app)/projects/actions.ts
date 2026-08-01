"use server";

import { redirect } from "next/navigation";
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

async function nextProjectCode() {
  const count = await prisma.project.count();
  return `PRJ${String(count + 1).padStart(3, "0")}`;
}

export async function createProjectAction(
  _prevState: { error: string | null },
  formData: FormData
): Promise<{ error: string | null }> {
  await requireUser();
  const name = String(formData.get("name") || "").trim();
  const clientId = String(formData.get("clientId") || "");
  if (!name || !clientId) {
    return { error: "Project name and client are required." };
  }

  const project = await prisma.project.create({
    data: {
      code: await nextProjectCode(),
      name,
      clientId,
      siteId: stringOrNull(formData.get("siteId")),
      description: stringOrNull(formData.get("description")),
      manager: stringOrNull(formData.get("manager")),
      timelineStart: dateOrNull(formData.get("timelineStart")),
      timelineEnd: dateOrNull(formData.get("timelineEnd")),
      status: String(formData.get("status") || "PLANNING"),
    },
  });

  revalidatePath("/projects");
  redirect(`/projects/${project.id}`);
}

// Basic Detail tab. Each tab below saves independently (a real Prisma
// `update` with only that tab's fields) so submitting one tab's form never
// touches — and can't accidentally null out — fields that live on another
// tab's form.
export async function updateProjectAction(formData: FormData) {
  await requireUser();
  const id = String(formData.get("projectId") || "");
  if (!id) return;

  const name = stringOrNull(formData.get("name"));

  await prisma.project.update({
    where: { id },
    data: {
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
    },
  });

  revalidatePath(`/projects/${id}`);
  revalidatePath("/projects");
}

// Location Details tab.
export async function updateProjectLocationAction(formData: FormData) {
  await requireUser();
  const id = String(formData.get("projectId") || "");
  if (!id) return;

  await prisma.project.update({
    where: { id },
    data: {
      siteId: stringOrNull(formData.get("siteId")),
      address: stringOrNull(formData.get("address")),
      latitude: numberOrNull(formData.get("latitude")),
      longitude: numberOrNull(formData.get("longitude")),
    },
  });

  revalidatePath(`/projects/${id}`);
}

// Other Details tab.
export async function updateProjectOtherDetailsAction(formData: FormData) {
  await requireUser();
  const id = String(formData.get("projectId") || "");
  if (!id) return;

  await prisma.project.update({
    where: { id },
    data: {
      description: stringOrNull(formData.get("description")),
    },
  });

  revalidatePath(`/projects/${id}`);
}

// --- Documents ---

export async function addProjectDocumentAction(formData: FormData) {
  const user = await requireUser();
  const projectId = String(formData.get("projectId") || "");
  const type = String(formData.get("type") || "OTHER");
  const expiryDate = dateOrNull(formData.get("expiryDate"));
  const file = formData.get("file");
  if (!projectId || !(file instanceof File) || file.size === 0) return;
  if (file.size > MAX_UPLOAD_BYTES) return;

  const buffer = Buffer.from(await file.arrayBuffer());
  await prisma.projectDocument.create({
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

  revalidatePath(`/projects/${projectId}`);
}

export async function deleteProjectDocumentAction(formData: FormData) {
  await requireUser();
  const id = String(formData.get("documentId") || "");
  const projectId = String(formData.get("projectId") || "");
  if (!id) return;
  await prisma.projectDocument.delete({ where: { id } });
  revalidatePath(`/projects/${projectId}`);
}

// --- Approved Rates (project-scoped ClientTradeRate) ---

export async function addProjectTradeRateAction(formData: FormData) {
  await requireUser();
  const projectId = String(formData.get("projectId") || "");
  const clientId = String(formData.get("clientId") || "");
  const trade = String(formData.get("trade") || "").trim();
  const rate = numberOrNull(formData.get("rate"));
  if (!projectId || !clientId || !trade || rate == null) return;

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
  await requireUser();
  const projectId = String(formData.get("projectId") || "");
  const rateId = String(formData.get("rateId") || "");
  if (!rateId) return;
  await prisma.clientTradeRate.delete({ where: { id: rateId } });
  revalidatePath(`/projects/${projectId}`);
}

// --- Holiday Details ---

export async function addProjectHolidayAction(formData: FormData) {
  await requireUser();
  const projectId = String(formData.get("projectId") || "");
  const date = dateOrNull(formData.get("date"));
  const label = String(formData.get("label") || "").trim();
  const rateMultiplier = numberOrNull(formData.get("rateMultiplier"));
  if (!projectId || !date || !label) return;

  await prisma.projectHoliday.upsert({
    where: { projectId_date: { projectId, date } },
    update: { label, rateMultiplier },
    create: { projectId, date, label, rateMultiplier },
  });

  revalidatePath(`/projects/${projectId}`);
}

export async function removeProjectHolidayAction(formData: FormData) {
  await requireUser();
  const projectId = String(formData.get("projectId") || "");
  const holidayId = String(formData.get("holidayId") || "");
  if (!holidayId) return;
  await prisma.projectHoliday.delete({ where: { id: holidayId } });
  revalidatePath(`/projects/${projectId}`);
}

// --- Related Users (ProjectContact) ---

export async function addProjectContactAction(formData: FormData) {
  await requireUser();
  const projectId = String(formData.get("projectId") || "");
  const name = String(formData.get("name") || "").trim();
  if (!projectId || !name) return;

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
  await requireUser();
  const projectId = String(formData.get("projectId") || "");
  const contactId = String(formData.get("contactId") || "");
  const name = String(formData.get("name") || "").trim();
  if (!contactId || !name) return;

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
  await requireUser();
  const projectId = String(formData.get("projectId") || "");
  const contactId = String(formData.get("contactId") || "");
  if (!contactId) return;
  await prisma.projectContact.delete({ where: { id: contactId } });
  revalidatePath(`/projects/${projectId}`);
}

// --- Inventory Details ---

export async function addProjectInventoryAction(formData: FormData) {
  await requireUser();
  const projectId = String(formData.get("projectId") || "");
  const itemName = String(formData.get("itemName") || "").trim();
  const quantity = Number(formData.get("quantity")) || 1;
  const assignedDate = dateOrNull(formData.get("assignedDate")) || new Date();
  const condition = stringOrNull(formData.get("condition"));
  if (!projectId || !itemName) return;

  const item = await prisma.inventoryItem.upsert({
    where: { name: itemName },
    update: {},
    create: { name: itemName },
  });

  await prisma.projectInventoryAssignment.create({
    data: { projectId, itemId: item.id, quantity, assignedDate, condition },
  });

  revalidatePath(`/projects/${projectId}`);
}

export async function returnProjectInventoryAction(formData: FormData) {
  await requireUser();
  const projectId = String(formData.get("projectId") || "");
  const assignmentId = String(formData.get("assignmentId") || "");
  if (!assignmentId) return;
  await prisma.projectInventoryAssignment.update({
    where: { id: assignmentId },
    data: { returnDate: new Date() },
  });
  revalidatePath(`/projects/${projectId}`);
}

export async function removeProjectInventoryAction(formData: FormData) {
  await requireUser();
  const projectId = String(formData.get("projectId") || "");
  const assignmentId = String(formData.get("assignmentId") || "");
  if (!assignmentId) return;
  await prisma.projectInventoryAssignment.delete({ where: { id: assignmentId } });
  revalidatePath(`/projects/${projectId}`);
}

export async function deleteProjectAction(formData: FormData) {
  await requireUser();
  const id = String(formData.get("projectId") || "");
  if (!id) return;

  // Unassigning employees is a soft, reversible consequence -- unlike a
  // Client with real timesheet history, it's safe to do automatically
  // rather than blocking the delete.
  await prisma.employee.updateMany({
    where: { projectId: id },
    data: { projectId: null },
  });
  await prisma.project.delete({ where: { id } });

  revalidatePath("/projects");
  revalidatePath("/employees");
  redirect("/projects");
}
