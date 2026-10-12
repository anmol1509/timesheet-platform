"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireUserWithBranch, requirePermission, requireWrite } from "@/lib/auth";
import { branchWhere } from "@/lib/branch";
import { routeBranch, vehicleBranch } from "@/lib/facilityScope";
import { logAudit } from "@/lib/audit";
import { assertContactsValid } from "@/lib/validators";

function stringOrNull(value: FormDataEntryValue | null) {
  const s = String(value || "").trim();
  return s || null;
}

/** A route's optional project must belong to the same branch as its vehicle. */
async function projectFitsBranch(projectId: string | null, ownerBranch: string | null) {
  if (!projectId) return true;
  return !!(await prisma.project.findFirst({ where: { id: projectId, ...branchWhere(ownerBranch) }, select: { id: true } }));
}

type StopInput = { location: string; pickupTime: string | null; notes: string | null };

function parseStops(stopsJson: FormDataEntryValue | null): StopInput[] {
  let stops: StopInput[];
  try {
    stops = JSON.parse(String(stopsJson || "[]"));
  } catch {
    stops = [];
  }
  return stops.filter((s) => s.location && s.location.trim());
}

export async function createRouteAction(formData: FormData) {
  await requireWrite("facilities.transport");
  assertContactsValid(formData);
  const { user, branchId, isSuperAdmin } = await requireUserWithBranch();
  const name = String(formData.get("name") || "").trim();
  const vehicleId = String(formData.get("vehicleId") || "");
  const projectId = stringOrNull(formData.get("projectId"));
  const stops = parseStops(formData.get("stopsJson"));
  if (!name || !vehicleId) return;
  const vehicleOwner = await vehicleBranch(vehicleId, { branchId, isSuperAdmin });
  if (vehicleOwner === undefined || !(await projectFitsBranch(projectId, vehicleOwner))) return;

  const route = await prisma.route.create({
    data: {
      name,
      vehicleId,
      projectId,
      stops: {
        create: stops.map((s, i) => ({
          location: s.location,
          stopOrder: i,
          pickupTime: s.pickupTime,
          notes: s.notes,
        })),
      },
    },
  });

  await logAudit({
    entityType: "ROUTE",
    entityId: route.id,
    action: "CREATE",
    after: { name, vehicleId, projectId, stops },
    userId: user.id,
    userName: user.name,
    branchId: vehicleOwner,
  });

  revalidatePath("/transport/routes");
  revalidatePath(`/transport/${vehicleId}`);
  redirect(`/transport/routes/${route.id}`);
}

export async function updateRouteAction(formData: FormData) {
  await requireWrite("facilities.transport");
  assertContactsValid(formData);
  const { user, branchId, isSuperAdmin } = await requireUserWithBranch();
  const id = String(formData.get("routeId") || "");
  if (!id) return;
  const routeOwner = await routeBranch(id, { branchId, isSuperAdmin });
  if (routeOwner === undefined) return;

  const before = await prisma.route.findUnique({ where: { id }, include: { stops: true } });
  if (!before) return;

  const name = String(formData.get("name") || "").trim();
  const vehicleId = String(formData.get("vehicleId") || "");
  const projectId = stringOrNull(formData.get("projectId"));
  const stops = parseStops(formData.get("stopsJson"));
  if (!name || !vehicleId) return;
  // The route may be moved to another vehicle, but only one in the same branch.
  const newVehicleOwner = await vehicleBranch(vehicleId, { branchId, isSuperAdmin });
  if (newVehicleOwner === undefined || newVehicleOwner !== routeOwner || !(await projectFitsBranch(projectId, routeOwner))) return;

  await prisma.$transaction([
    prisma.routeStop.deleteMany({ where: { routeId: id } }),
    prisma.route.update({
      where: { id },
      data: {
        name,
        vehicleId,
        projectId,
        stops: {
          create: stops.map((s, i) => ({
            location: s.location,
            stopOrder: i,
            pickupTime: s.pickupTime,
            notes: s.notes,
          })),
        },
      },
    }),
  ]);

  await logAudit({
    entityType: "ROUTE",
    entityId: id,
    action: "UPDATE",
    before: { name: before.name, vehicleId: before.vehicleId, projectId: before.projectId, stops: before.stops },
    after: { name, vehicleId, projectId, stops },
    userId: user.id,
    userName: user.name,
    branchId: routeOwner,
  });

  revalidatePath("/transport/routes");
  revalidatePath(`/transport/routes/${id}`);
  revalidatePath(`/transport/${vehicleId}`);
  if (before.vehicleId !== vehicleId) revalidatePath(`/transport/${before.vehicleId}`);
}

export async function deleteRouteAction(formData: FormData) {
  await requireWrite("facilities.transport");
  assertContactsValid(formData);
  await requirePermission("facilities.transport", "delete");
  const { user, branchId, isSuperAdmin } = await requireUserWithBranch();
  const id = String(formData.get("routeId") || "");
  if (!id) return;
  const routeOwner = await routeBranch(id, { branchId, isSuperAdmin });
  if (routeOwner === undefined) return;

  const existing = await prisma.route.findUnique({ where: { id } });
  if (!existing) return;

  await prisma.route.delete({ where: { id } });

  await logAudit({
    entityType: "ROUTE",
    entityId: id,
    action: "DELETE",
    before: { name: existing.name, vehicleId: existing.vehicleId, projectId: existing.projectId },
    userId: user.id,
    userName: user.name,
    branchId: routeOwner,
  });

  revalidatePath("/transport/routes");
  revalidatePath(`/transport/${existing.vehicleId}`);
  redirect("/transport/routes");
}
