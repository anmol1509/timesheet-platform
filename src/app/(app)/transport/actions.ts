"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";

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
  await requireUser();
  const plateNumber = String(formData.get("plateNumber") || "").trim();
  if (!plateNumber) return;
  const type = stringOrNull(formData.get("type"));

  const existing = await prisma.vehicle.findUnique({ where: { plateNumber } });
  if (existing) {
    redirect(
      `/transport?error=${encodeURIComponent("A vehicle with that plate number already exists.")}`
    );
  }

  const vehicle = await prisma.vehicle.create({ data: { plateNumber, type } });
  revalidatePath("/transport");
  redirect(`/transport/${vehicle.id}`);
}

export async function updateVehicleAction(formData: FormData) {
  await requireUser();
  const id = String(formData.get("vehicleId") || "");
  if (!id) return;

  await prisma.vehicle.update({
    where: { id },
    data: {
      type: stringOrNull(formData.get("type")),
      capacity: numberOrNull(formData.get("capacity")),
      driverName: stringOrNull(formData.get("driverName")),
      driverPhone: stringOrNull(formData.get("driverPhone")),
      registrationExpiry: dateOrNull(formData.get("registrationExpiry")),
      insuranceExpiry: dateOrNull(formData.get("insuranceExpiry")),
      status: String(formData.get("status") || "ACTIVE"),
      notes: stringOrNull(formData.get("notes")),
    },
  });

  revalidatePath(`/transport/${id}`);
  revalidatePath("/transport");
}

export async function deleteVehicleAction(formData: FormData) {
  await requireUser();
  const id = String(formData.get("vehicleId") || "");
  if (!id) return;

  // Unassigning employees is a reversible, soft consequence — safe to do
  // automatically rather than blocking the delete.
  await prisma.employee.updateMany({
    where: { vehicleId: id },
    data: { vehicleId: null },
  });
  await prisma.vehicle.delete({ where: { id } });

  revalidatePath("/transport");
  revalidatePath("/employees");
  redirect("/transport");
}

export async function assignEmployeesToVehicleAction(formData: FormData) {
  await requireUser();
  const vehicleId = String(formData.get("vehicleId") || "");
  const employeeIds = formData.getAll("employeeId").map(String).filter(Boolean);
  if (!vehicleId || employeeIds.length === 0) return;
  await prisma.employee.updateMany({
    where: { id: { in: employeeIds } },
    data: { vehicleId },
  });
  revalidatePath(`/transport/${vehicleId}`);
}

export async function unassignEmployeeFromVehicleAction(formData: FormData) {
  await requireUser();
  const vehicleId = String(formData.get("vehicleId") || "");
  const employeeId = String(formData.get("employeeId") || "");
  if (!employeeId) return;
  await prisma.employee.update({
    where: { id: employeeId },
    data: { vehicleId: null },
  });
  revalidatePath(`/transport/${vehicleId}`);
}

export async function addVehicleProjectAction(formData: FormData) {
  await requireUser();
  const vehicleId = String(formData.get("vehicleId") || "");
  const projectId = String(formData.get("projectId") || "");
  if (!vehicleId || !projectId) return;
  await prisma.vehicleProject.upsert({
    where: { vehicleId_projectId: { vehicleId, projectId } },
    update: {},
    create: { vehicleId, projectId },
  });
  revalidatePath(`/transport/${vehicleId}`);
}

export async function removeVehicleProjectAction(formData: FormData) {
  await requireUser();
  const vehicleId = String(formData.get("vehicleId") || "");
  const projectId = String(formData.get("projectId") || "");
  if (!vehicleId || !projectId) return;
  await prisma.vehicleProject
    .delete({ where: { vehicleId_projectId: { vehicleId, projectId } } })
    .catch(() => {});
  revalidatePath(`/transport/${vehicleId}`);
}
