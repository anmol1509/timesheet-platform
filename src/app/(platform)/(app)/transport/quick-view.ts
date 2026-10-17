"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireUserWithBranch, subjectOf } from "@/lib/auth";
import { canWrite } from "@/lib/permissions";
import { branchWhere } from "@/lib/branch";
import { vehicleBranch } from "@/lib/facilityScope";
import { logAudit } from "@/lib/audit";
import { assertContactsValid } from "@/lib/validators";

/**
 * The vehicle quick view: driver, driver phone, registration and insurance dates and status, saved one at a time,
 * plus who rides it. Plate, type, capacity, routes and projects stay on the full vehicle page.
 */
const SCOPE = "facilities.transport";
const STATUSES = ["ACTIVE", "MAINTENANCE", "INACTIVE"];
const iso = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : null);

export type Rider = { id: string; name: string; employeeIdNo: string };
export type VehicleQuickView = {
  id: string;
  plateNumber: string;
  type: string | null;
  capacity: number | null;
  status: string;
  driverName: string | null;
  driverPhone: string | null;
  registrationExpiry: string | null;
  insuranceExpiry: string | null;
  riders: Rider[];
  /** Workers not on any vehicle, who can be added. */
  available: Rider[];
  canEdit: boolean;
};

export async function loadVehicleQuickViewAction(id: string): Promise<VehicleQuickView | null> {
  const { user, branchId, isSuperAdmin } = await requireUserWithBranch();
  const owner = await vehicleBranch(id, { branchId, isSuperAdmin });
  if (owner === undefined) return null;
  const v = await prisma.vehicle.findUnique({ where: { id }, include: { employees: { select: { id: true, name: true, employeeIdNo: true }, orderBy: { name: "asc" } } } });
  if (!v) return null;
  const available = await prisma.employee.findMany({ where: { ...branchWhere(owner), active: true, vehicleId: null }, select: { id: true, name: true, employeeIdNo: true }, orderBy: { name: "asc" }, take: 500 });
  return {
    id: v.id,
    plateNumber: v.plateNumber,
    type: v.type,
    capacity: v.capacity,
    status: v.status,
    driverName: v.driverName,
    driverPhone: v.driverPhone,
    registrationExpiry: iso(v.registrationExpiry),
    insuranceExpiry: iso(v.insuranceExpiry),
    riders: v.employees,
    available,
    canEdit: canWrite(subjectOf(user), SCOPE),
  };
}

export type VehicleSaveResult = { ok: true; value: string | null; previous: string | null } | { ok?: false; error?: string };
const FIELDS = new Set(["driverName", "driverPhone", "registrationExpiry", "insuranceExpiry", "status"]);

export async function saveVehicleFieldAction(input: { id: string; field: string; value: string | null }): Promise<VehicleSaveResult> {
  const { user, branchId, isSuperAdmin } = await requireUserWithBranch();
  if (!canWrite(subjectOf(user), SCOPE)) return { error: "You don't have permission to edit vehicles." };
  const { id, field } = input;
  if (!FIELDS.has(field)) return { error: "That field can't be edited here." };
  const owner = await vehicleBranch(id, { branchId, isSuperAdmin });
  if (owner === undefined) return { error: "That vehicle isn't in this branch." };
  const before = await prisma.vehicle.findUnique({ where: { id } });
  if (!before) return { error: "That vehicle no longer exists." };

  const raw = (input.value ?? "").trim();
  let value: string | Date | null = raw || null;
  if (field === "status" && (!value || !STATUSES.includes(value as string))) return { error: "Choose a valid status." };
  if (field === "registrationExpiry" || field === "insuranceExpiry") {
    if (value) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(value as string) || Number.isNaN(new Date(value as string).getTime())) return { error: "Enter a valid date." };
      value = new Date(value as string);
    }
  }
  if (field === "driverPhone") {
    try {
      const f = new FormData();
      f.set("driverPhone", (value as string) ?? "");
      assertContactsValid(f);
    } catch (e) {
      return { error: e instanceof Error ? e.message : "That phone number isn't valid." };
    }
  }
  await prisma.vehicle.update({ where: { id }, data: { [field]: value } });
  const prev = (before as Record<string, unknown>)[field];
  await logAudit({ entityType: "VEHICLE", entityId: id, action: "UPDATE", before: { [field]: prev }, after: { [field]: value }, userId: user.id, userName: user.name, branchId: owner });
  revalidatePath(`/transport/${id}`);
  revalidatePath("/transport");
  const out = (v: unknown) => (v instanceof Date ? iso(v) : v === null || v === undefined ? null : String(v));
  return { ok: true, value: out(value), previous: out(prev) };
}

/** Puts a worker on the vehicle, or takes them off it (null). Over capacity is allowed; the panel shows the count. */
export async function setRiderAction(input: { vehicleId: string; employeeId: string; on: boolean }): Promise<{ ok: true } | { error: string }> {
  const { user, branchId, isSuperAdmin } = await requireUserWithBranch();
  if (!canWrite(subjectOf(user), SCOPE)) return { error: "You don't have permission to edit vehicles." };
  const owner = await vehicleBranch(input.vehicleId, { branchId, isSuperAdmin });
  if (owner === undefined) return { error: "That vehicle isn't in this branch." };
  const e = await prisma.employee.findFirst({ where: { id: input.employeeId, ...branchWhere(owner) }, select: { id: true, name: true, vehicleId: true } });
  if (!e) return { error: "That worker isn't in this branch." };
  if (input.on && e.vehicleId && e.vehicleId !== input.vehicleId) return { error: `${e.name} is already on another vehicle.` };
  if (!input.on && e.vehicleId !== input.vehicleId) return { ok: true };
  await prisma.employee.update({ where: { id: e.id }, data: { vehicleId: input.on ? input.vehicleId : null } });
  await logAudit({ entityType: "VEHICLE", entityId: input.vehicleId, action: "UPDATE", before: { rider: input.on ? null : e.name }, after: { rider: input.on ? e.name : null }, userId: user.id, userName: user.name, branchId: owner });
  revalidatePath(`/transport/${input.vehicleId}`);
  revalidatePath("/transport");
  return { ok: true };
}
