"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requirePermission, requireUserWithBranch, requireWrite } from "@/lib/auth";
import { branchWhere, isOutsideBranch } from "@/lib/branch";
import { vehicleBranch } from "@/lib/facilityScope";
import { logAudit } from "@/lib/audit";
import { assertContactsValid } from "@/lib/validators";

function stringOrNull(value: FormDataEntryValue | null) {
  const s = String(value || "").trim();
  return s || null;
}

function dateOrNull(value: FormDataEntryValue | null) {
  const s = String(value || "").trim();
  return s ? new Date(s) : null;
}

function numberOrNull(value: FormDataEntryValue | null) {
  const s = String(value || "").trim();
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

export async function createVehicleAction(formData: FormData) {
  await requireWrite("facilities.transport");
  assertContactsValid(formData);
  const { user, branchId } = await requireUserWithBranch();
  const plateNumber = String(formData.get("plateNumber") || "").trim();
  if (!plateNumber) return;
  // A vehicle with no branch would be invisible to every branch-scoped user.
  if (!branchId) redirect(`/transport?error=${encodeURIComponent("Pick a branch from the switcher first.")}`);
  const type = stringOrNull(formData.get("type"));

  // Scoped to the branch: checking globally would report a clash with another
  // tenant's vehicle, which both blocks a legitimate plate and reveals that
  // the other tenant has it.
  const existing = await prisma.vehicle.findFirst({
    where: { plateNumber, ...branchWhere(branchId) },
    select: { id: true },
  });
  if (existing) {
    redirect(
      `/transport?error=${encodeURIComponent("A vehicle with that plate number already exists.")}`
    );
  }

  const vehicle = await prisma.vehicle.create({ data: { plateNumber, type, branchId } });

  await logAudit({
    entityType: "VEHICLE",
    entityId: vehicle.id,
    action: "CREATE",
    after: { plateNumber, type },
    userId: user.id,
    userName: user.name,
    branchId,
  });

  revalidatePath("/transport");
  redirect(`/transport/${vehicle.id}`);
}

export async function updateVehicleAction(formData: FormData) {
  await requireWrite("facilities.transport");
  assertContactsValid(formData);
  const { user, branchId, isSuperAdmin } = await requireUserWithBranch();
  const id = String(formData.get("vehicleId") || "");
  if (!id) return;
  const vehicleOwner = await vehicleBranch(id, { branchId, isSuperAdmin });
  if (vehicleOwner === undefined) return;

  const before = await prisma.vehicle.findUnique({ where: { id } });

  const data = {
    type: stringOrNull(formData.get("type")),
    capacity: numberOrNull(formData.get("capacity")),
    driverName: stringOrNull(formData.get("driverName")),
    driverPhone: stringOrNull(formData.get("driverPhone")),
    registrationExpiry: dateOrNull(formData.get("registrationExpiry")),
    insuranceExpiry: dateOrNull(formData.get("insuranceExpiry")),
    status: String(formData.get("status") || "ACTIVE"),
    notes: stringOrNull(formData.get("notes")),
  };

  await prisma.vehicle.update({ where: { id }, data });

  await logAudit({
    entityType: "VEHICLE",
    entityId: id,
    action: "UPDATE",
    before: before as unknown as Record<string, unknown>,
    after: data,
    userId: user.id,
    userName: user.name,
    branchId: vehicleOwner,
  });

  revalidatePath(`/transport/${id}`);
  revalidatePath("/transport");
}

export async function deleteVehicleAction(formData: FormData) {
  await requireWrite("facilities.transport");
  assertContactsValid(formData);
  await requirePermission("facilities.transport", "delete");
  const { user, branchId, isSuperAdmin } = await requireUserWithBranch();
  const id = String(formData.get("vehicleId") || "");
  if (!id) return;
  const vehicleOwner = await vehicleBranch(id, { branchId, isSuperAdmin });
  if (vehicleOwner === undefined) return;

  const existing = await prisma.vehicle.findUnique({ where: { id } });

  // Unassigning employees is a reversible, soft consequence — safe to do
  // automatically rather than blocking the delete.
  await prisma.employee.updateMany({
    where: { vehicleId: id },
    data: { vehicleId: null },
  });
  await prisma.vehicle.delete({ where: { id } });

  if (existing) {
    await logAudit({
      entityType: "VEHICLE",
      entityId: id,
      action: "DELETE",
      before: existing as unknown as Record<string, unknown>,
      userId: user.id,
      userName: user.name,
      branchId: vehicleOwner,
    });
  }

  revalidatePath("/transport");
  revalidatePath("/employees");
  redirect("/transport");
}

export async function assignEmployeesToVehicleAction(formData: FormData) {
  await requireWrite("facilities.transport");
  assertContactsValid(formData);
  const { branchId, isSuperAdmin } = await requireUserWithBranch();
  const vehicleId = String(formData.get("vehicleId") || "");
  const employeeIds = formData.getAll("employeeId").map(String).filter(Boolean);
  if (!vehicleId || employeeIds.length === 0) return;
  const vehicleOwner = await vehicleBranch(vehicleId, { branchId, isSuperAdmin });
  if (vehicleOwner === undefined) return;
  // The ids come from the form: without the branch filter, listing another
  // tenant's employee ids would reassign their people to this vehicle.
  await prisma.employee.updateMany({
    where: { id: { in: employeeIds }, ...branchWhere(vehicleOwner) },
    data: { vehicleId },
  });
  revalidatePath(`/transport/${vehicleId}`);
}

export async function unassignEmployeeFromVehicleAction(formData: FormData) {
  await requireWrite("facilities.transport");
  assertContactsValid(formData);
  const { branchId, isSuperAdmin } = await requireUserWithBranch();
  const vehicleId = String(formData.get("vehicleId") || "");
  const employeeId = String(formData.get("employeeId") || "");
  if (!employeeId) return;
  const employee = await prisma.employee.findUnique({ where: { id: employeeId }, select: { branchId: true } });
  if (!employee || isOutsideBranch(employee.branchId, branchId, isSuperAdmin)) return;
  await prisma.employee.update({
    where: { id: employeeId },
    data: { vehicleId: null },
  });
  revalidatePath(`/transport/${vehicleId}`);
}

export async function addVehicleProjectAction(formData: FormData) {
  await requireWrite("facilities.transport");
  assertContactsValid(formData);
  const { branchId, isSuperAdmin } = await requireUserWithBranch();
  const vehicleId = String(formData.get("vehicleId") || "");
  const projectId = String(formData.get("projectId") || "");
  if (!vehicleId || !projectId) return;
  const vehicleOwner = await vehicleBranch(vehicleId, { branchId, isSuperAdmin });
  if (vehicleOwner === undefined) return;
  if (!(await prisma.project.findFirst({ where: { id: projectId, ...branchWhere(vehicleOwner) }, select: { id: true } }))) return;
  await prisma.vehicleProject.upsert({
    where: { vehicleId_projectId: { vehicleId, projectId } },
    update: {},
    create: { vehicleId, projectId },
  });
  revalidatePath(`/transport/${vehicleId}`);
}

export async function removeVehicleProjectAction(formData: FormData) {
  await requireWrite("facilities.transport");
  assertContactsValid(formData);
  const { branchId, isSuperAdmin } = await requireUserWithBranch();
  const vehicleId = String(formData.get("vehicleId") || "");
  const projectId = String(formData.get("projectId") || "");
  if (!vehicleId || !projectId) return;
  if ((await vehicleBranch(vehicleId, { branchId, isSuperAdmin })) === undefined) return;
  await prisma.vehicleProject
    .delete({ where: { vehicleId_projectId: { vehicleId, projectId } } })
    .catch(() => {});
  revalidatePath(`/transport/${vehicleId}`);
}
