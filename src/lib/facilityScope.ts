import { prisma } from "@/lib/db";
import { isOutsideBranch } from "@/lib/branch";

/**
 * Ownership guards for facilities data.
 *
 * Camp and Vehicle carry a branchId; Room, Bed, Route and RouteStop have none
 * and inherit their parent's. Every write that takes one of these ids from a
 * form must prove the record is the caller's before touching it — a bare
 * `findUnique({ id })` followed by an update is exactly how one tenant edits
 * or deletes another's data by guessing or reusing an id.
 *
 * Each helper returns the record's branchId when the caller may act on it, or
 * `undefined` when the record doesn't exist or belongs to another branch, so a
 * caller can also file its audit entry under the correct branch. A super
 * admin is never "outside" a branch, matching isOutsideBranch everywhere else.
 */
type Scope = { branchId: string | null; isSuperAdmin: boolean };

async function allowed(recordBranchId: string | null | undefined, exists: boolean, s: Scope) {
  if (!exists) return undefined;
  if (isOutsideBranch(recordBranchId, s.branchId, s.isSuperAdmin)) return undefined;
  return recordBranchId ?? null;
}

export async function campBranch(campId: string, s: Scope) {
  const camp = await prisma.camp.findUnique({ where: { id: campId }, select: { branchId: true } });
  return allowed(camp?.branchId, !!camp, s);
}

export async function roomBranch(roomId: string, s: Scope) {
  const room = await prisma.room.findUnique({ where: { id: roomId }, select: { camp: { select: { branchId: true } } } });
  return allowed(room?.camp.branchId, !!room, s);
}

export async function bedBranch(bedId: string, s: Scope) {
  const bed = await prisma.bed.findUnique({ where: { id: bedId }, select: { room: { select: { camp: { select: { branchId: true } } } } } });
  return allowed(bed?.room.camp.branchId, !!bed, s);
}

export async function vehicleBranch(vehicleId: string, s: Scope) {
  const vehicle = await prisma.vehicle.findUnique({ where: { id: vehicleId }, select: { branchId: true } });
  return allowed(vehicle?.branchId, !!vehicle, s);
}

export async function routeBranch(routeId: string, s: Scope) {
  const route = await prisma.route.findUnique({ where: { id: routeId }, select: { vehicle: { select: { branchId: true } } } });
  return allowed(route?.vehicle.branchId, !!route, s);
}
