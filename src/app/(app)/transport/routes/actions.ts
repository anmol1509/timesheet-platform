"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { logAudit } from "@/lib/audit";

function stringOrNull(value: FormDataEntryValue | null) {
  const s = String(value || "").trim();
  return s || null;
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
  const user = await requireUser();
  const name = String(formData.get("name") || "").trim();
  const vehicleId = String(formData.get("vehicleId") || "");
  const projectId = stringOrNull(formData.get("projectId"));
  const stops = parseStops(formData.get("stopsJson"));
  if (!name || !vehicleId) return;

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
    branchId: null,
  });

  revalidatePath("/transport/routes");
  revalidatePath(`/transport/${vehicleId}`);
  redirect(`/transport/routes/${route.id}`);
}

export async function updateRouteAction(formData: FormData) {
  const user = await requireUser();
  const id = String(formData.get("routeId") || "");
  if (!id) return;

  const before = await prisma.route.findUnique({ where: { id }, include: { stops: true } });
  if (!before) return;

  const name = String(formData.get("name") || "").trim();
  const vehicleId = String(formData.get("vehicleId") || "");
  const projectId = stringOrNull(formData.get("projectId"));
  const stops = parseStops(formData.get("stopsJson"));
  if (!name || !vehicleId) return;

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
    branchId: null,
  });

  revalidatePath("/transport/routes");
  revalidatePath(`/transport/routes/${id}`);
  revalidatePath(`/transport/${vehicleId}`);
  if (before.vehicleId !== vehicleId) revalidatePath(`/transport/${before.vehicleId}`);
}

export async function deleteRouteAction(formData: FormData) {
  const user = await requireUser();
  const id = String(formData.get("routeId") || "");
  if (!id) return;

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
    branchId: null,
  });

  revalidatePath("/transport/routes");
  revalidatePath(`/transport/${existing.vehicleId}`);
  redirect("/transport/routes");
}
