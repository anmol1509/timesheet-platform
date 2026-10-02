"use server";

import { checkOutNow, settleDueCheckouts } from "@/lib/accommodationCheckout";
import { checkoutKind, checkoutProblem, dayKey } from "@/lib/checkoutReasons";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireUser, requireUserWithBranch, requirePermission } from "@/lib/auth";
import { branchWhere, isOutsideBranch } from "@/lib/branch";
import { bedBranch, campBranch, roomBranch } from "@/lib/facilityScope";
import { logAudit } from "@/lib/audit";
import { bunkLabel, nextBunkNo, singleLabel } from "@/lib/bunk";
import { assertContactsValid } from "@/lib/validators";

type RoomSpec = { name: string; bedCount: number; bunkCount: number };

function parseRoomSpecs(raw: FormDataEntryValue | null): RoomSpec[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(String(raw || "[]"));
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];
  return parsed
    .map((r) => ({
      name: String((r as { name?: unknown })?.name || "").trim(),
      bedCount: Math.max(0, Math.min(20, Number((r as { bedCount?: unknown })?.bedCount) || 0)),
      bunkCount: Math.max(0, Math.min(20, Number((r as { bunkCount?: unknown })?.bunkCount) || 0)),
    }))
    .filter((r) => r.name.length > 0 && r.bedCount + r.bunkCount > 0);
}

// Asks for the camp's full room/bed layout up front, rather than an empty
// camp a user then has to add rooms to one at a time.
export async function createCampWithRoomsAction(
  formData: FormData
): Promise<{ campId: string } | { error: string }> {
  assertContactsValid(formData);
  const { user, branchId } = await requireUserWithBranch();
  // A camp with no branch is invisible to every branch-scoped user, including
  // whoever just created it — so a super admin must pick one first.
  if (!branchId) return { error: "Pick a branch from the switcher first." };
  const name = String(formData.get("name") || "").trim();
  // Camps created here are always the company's own; supplier and client camps are recorded at check-in.
  const ownerType = "OWN";
  const owningSupplierId = null;
  const rooms = parseRoomSpecs(formData.get("roomsJson"));
  if (!name) return { error: "Camp name is required." };
  if (rooms.length === 0) return { error: "Add at least one room with a bed or a bunk." };

  let campId: string;
  try {
    campId = await prisma.$transaction(async (tx) => {
      const camp = await tx.camp.create({ data: { name, ownerType, owningSupplierId, branchId } });
      for (const room of rooms) {
        const createdRoom = await tx.room.create({
          data: { campId: camp.id, name: room.name, bedSpace: room.bedCount + room.bunkCount * 2, usableBedSpace: room.bedCount + room.bunkCount * 2 },
        });
        await tx.bed.createMany({
          data: [
            ...Array.from({ length: room.bedCount }, (_, i) => ({ roomId: createdRoom.id, label: singleLabel(i + 1) })),
            ...Array.from({ length: room.bunkCount }, (_, i) => [
              { roomId: createdRoom.id, label: bunkLabel(i + 1, "Upper") },
              { roomId: createdRoom.id, label: bunkLabel(i + 1, "Lower") },
            ]).flat(),
          ],
        });
      }
      return camp.id;
    });
  } catch {
    return { error: `A camp named "${name}" already exists.` };
  }

  await logAudit({
    entityType: "CAMP",
    entityId: campId,
    action: "CREATE",
    after: { name, ownerType, owningSupplierId, rooms },
    userId: user.id,
    userName: user.name,
    branchId,
  });

  revalidatePath("/accommodation/camps");
  return { campId };
}

export async function updateCampOwnershipAction(formData: FormData) {
  assertContactsValid(formData);
  const { user, branchId, isSuperAdmin } = await requireUserWithBranch();
  const campId = String(formData.get("campId") || "");
  const rawType = String(formData.get("ownerType") || "OWN");
  const ownerType = rawType === "SUPPLIER" || rawType === "CLIENT" ? rawType : "OWN";
  const owningSupplierId = ownerType === "SUPPLIER" ? stringOrNull(formData.get("supplierId")) : null;
  const owningClientId = ownerType === "CLIENT" ? stringOrNull(formData.get("clientId")) : null;
  if (!campId) return;

  const campOwner = await campBranch(campId, { branchId, isSuperAdmin });
  if (campOwner === undefined) return;
  // The supplier is a foreign id from the form: it must be one of this camp's
  // own branch's suppliers, or a camp could be pointed at another tenant's.
  if (owningSupplierId && !(await prisma.supplier.findFirst({ where: { id: owningSupplierId, ...branchWhere(campOwner) }, select: { id: true } }))) return;

  if (owningClientId && !(await prisma.client.findFirst({ where: { id: owningClientId, ...branchWhere(campOwner) }, select: { id: true } }))) return;

  const before = await prisma.camp.findUnique({ where: { id: campId } });
  await prisma.camp.update({ where: { id: campId }, data: { ownerType, owningSupplierId, owningClientId } });

  await logAudit({
    entityType: "CAMP",
    entityId: campId,
    action: "UPDATE",
    before: before as unknown as Record<string, unknown>,
    after: { ownerType, owningSupplierId, owningClientId },
    userId: user.id,
    userName: user.name,
    branchId: campOwner,
  });

  revalidatePath("/accommodation/camps");
}

function stringOrNull(value: FormDataEntryValue | null) {
  const s = String(value || "").trim();
  return s || null;
}

function intOrNull(value: FormDataEntryValue | null) {
  const s = String(value || "").trim();
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? Math.trunc(n) : null;
}

export async function createRoomAction(formData: FormData) {
  assertContactsValid(formData);
  const { user, branchId, isSuperAdmin } = await requireUserWithBranch();
  const campId = String(formData.get("campId") || "");
  const name = String(formData.get("name") || "").trim();
  const bedCount = Math.max(0, Math.min(20, Number(formData.get("bedCount")) || 0));
  const bunkCount = Math.max(0, Math.min(20, Number(formData.get("bunkCount")) || 0));
  const bedSpace = intOrNull(formData.get("bedSpace"));
  const usableBedSpace = intOrNull(formData.get("usableBedSpace"));
  const roomType = stringOrNull(formData.get("roomType"));
  const nationality = stringOrNull(formData.get("nationality"));
  if (!campId || !name || bedCount + bunkCount === 0) return;
  const campOwner = await campBranch(campId, { branchId, isSuperAdmin });
  if (campOwner === undefined) return;

  const room = await prisma.room.create({
    data: { campId, name, bedSpace, usableBedSpace, roomType, nationality },
  });
  await prisma.bed.createMany({
    data: [
      ...Array.from({ length: bedCount }, (_, i) => ({ roomId: room.id, label: singleLabel(i + 1) })),
      ...Array.from({ length: bunkCount }, (_, i) => [
        { roomId: room.id, label: bunkLabel(i + 1, "Upper") },
        { roomId: room.id, label: bunkLabel(i + 1, "Lower") },
      ]).flat(),
    ],
  });

  await logAudit({
    entityType: "ROOM",
    entityId: room.id,
    action: "CREATE",
    after: { campId, name, bedCount, bunkCount, bedSpace, usableBedSpace, roomType, nationality },
    userId: user.id,
    userName: user.name,
    branchId: campOwner,
  });

  revalidatePath("/accommodation/camps");
}

export async function updateCampAction(formData: FormData) {
  assertContactsValid(formData);
  const { user, branchId, isSuperAdmin } = await requireUserWithBranch();
  const campId = String(formData.get("campId") || "");
  const name = String(formData.get("name") || "").trim();
  if (!campId || !name) return;
  const campOwner = await campBranch(campId, { branchId, isSuperAdmin });
  if (campOwner === undefined) return;

  const before = await prisma.camp.findUnique({ where: { id: campId } });
  await prisma.camp.update({ where: { id: campId }, data: { name } });

  await logAudit({
    entityType: "CAMP",
    entityId: campId,
    action: "UPDATE",
    before: before as unknown as Record<string, unknown>,
    after: { name },
    userId: user.id,
    userName: user.name,
    branchId: campOwner,
  });

  revalidatePath("/accommodation/camps");
}

export async function addBedsToRoomAction(formData: FormData) {
  assertContactsValid(formData);
  const { branchId, isSuperAdmin } = await requireUserWithBranch();
  const roomId = String(formData.get("roomId") || "");
  const kind = String(formData.get("kind") || "single") === "bunk" ? "bunk" : "single";
  const count = Math.max(1, Math.min(20, Number(formData.get("count")) || 1));
  if (!roomId) return;
  if ((await roomBranch(roomId, { branchId, isSuperAdmin })) === undefined) return;

  const existing = await prisma.bed.findMany({ where: { roomId }, select: { label: true } });
  if (kind === "bunk") {
    const start = nextBunkNo(existing.map((b) => b.label));
    await prisma.bed.createMany({
      data: Array.from({ length: count }, (_, i) => [
        { roomId, label: bunkLabel(start + i, "Upper") },
        { roomId, label: bunkLabel(start + i, "Lower") },
      ]).flat(),
    });
  } else {
    // Continue the single-bed numbering, ignoring bunk berths.
    const singles = existing.filter((b) => !/^Bunk/i.test(b.label)).length;
    await prisma.bed.createMany({ data: Array.from({ length: count }, (_, i) => ({ roomId, label: singleLabel(singles + i + 1) })) });
  }

  revalidatePath("/accommodation/camps");
}

// The employee AND the bed must both belong to the caller's branch, and to the
// same branch as each other: checking only the employee let one tenant put a
// worker into another tenant's bed.
//
// A direct bed assignment (from the Employee profile's own Accommodation
// section, bypassing Create Check-In/Bed Allocation) still needs a
// CampCheckIn row behind it, or the employee would show a bed but never
// appear "checked in" anywhere — so one is opened (or reused/moved) here too.
export async function assignBedAction(formData: FormData) {
  assertContactsValid(formData);
  const { user, branchId, isSuperAdmin } = await requireUserWithBranch();
  await settleDueCheckouts(branchId, user);
  const bedId = String(formData.get("bedId") || "");
  const employeeId = String(formData.get("employeeId") || "");
  if (!bedId || !employeeId) return;
  const employee = await prisma.employee.findUnique({ where: { id: employeeId }, select: { branchId: true } });
  if (!employee || isOutsideBranch(employee.branchId, branchId, isSuperAdmin)) return;

  const bed = await prisma.bed.findUnique({ where: { id: bedId }, include: { room: { include: { camp: true } } } });
  if (!bed) return;
  if (isOutsideBranch(bed.room.camp.branchId, branchId, isSuperAdmin)) return;
  // Even a super admin must not house one tenant's worker in another's camp.
  if (bed.room.camp.branchId !== employee.branchId) return;

  await prisma.$transaction(async (tx) => {
    await tx.bed.update({ where: { id: bedId }, data: { employeeId } });

    await tx.accommodationHistory.create({
      data: { employeeId, campName: bed.room.camp.name, roomName: bed.room.name, bedLabel: bed.label },
    });

    const openCheckIn = await tx.campCheckIn.findFirst({
      where: { employeeId, status: { in: ["CHECKED_IN", "BED_ALLOCATED"] } },
      orderBy: { createdAt: "desc" },
    });
    if (openCheckIn) {
      await tx.campCheckIn.update({
        where: { id: openCheckIn.id },
        data: { campId: bed.room.campId, bedId, status: "BED_ALLOCATED" },
      });
    } else {
      await tx.campCheckIn.create({
        data: {
          employeeId,
          campId: bed.room.campId,
          bedId,
          status: "BED_ALLOCATED",
          branchId: employee.branchId,
        },
      });
    }
  });

  await logAudit({
    entityType: "ACCOMMODATION",
    entityId: bedId,
    action: "UPDATE",
    after: { employeeId, campName: bed.room.camp.name, roomName: bed.room.name, bedLabel: bed.label },
    userId: user.id,
    userName: user.name,
    branchId,
  });

  revalidatePath("/accommodation/camps");
  revalidatePath("/accommodation/checkin");
  revalidatePath("/accommodation/bed-allocation");
  revalidatePath(`/employees/${employeeId}`);
}

export type CheckoutResult = { error?: string; scheduled?: boolean; date?: string };

/**
 * Checks a worker out of their bed with a reason and a date. A date today or earlier frees the bed at
 * once and records the stay as ending then; a later date is a scheduled checkout: the worker keeps the
 * bed until that day, when it is released the next time a camp screen loads.
 */
export async function checkOutWorkerAction(formData: FormData): Promise<CheckoutResult> {
  assertContactsValid(formData);
  await requirePermission("facilities", "edit");
  const { user, branchId, isSuperAdmin } = await requireUserWithBranch();
  const employeeId = String(formData.get("employeeId") || "");
  const date = String(formData.get("date") || "");
  const reason = String(formData.get("reason") || "");
  const note = String(formData.get("note") || "").trim().slice(0, 300);
  if (!employeeId) return { error: "Choose who is leaving." };
  const employee = await prisma.employee.findUnique({ where: { id: employeeId }, select: { branchId: true, bed: { select: { id: true } } } });
  if (!employee || isOutsideBranch(employee.branchId, branchId, isSuperAdmin)) return { error: "You can't check that worker out." };
  if (!employee.bed) return { error: "They aren't in a bed." };

  const open = await prisma.accommodationHistory.findFirst({ where: { employeeId, checkOutDate: null }, orderBy: { checkInDate: "desc" } });
  const problem = checkoutProblem({ date, reason, note, checkInDate: open ? dayKey(open.checkInDate) : "1970-01-01" });
  if (problem) return { error: problem };

  if (checkoutKind(date) === "future") {
    if (!open) return { error: "There's no open stay to schedule a checkout for." };
    await prisma.accommodationHistory.update({ where: { id: open.id }, data: { plannedCheckOutDate: new Date(`${date}T12:00:00Z`), plannedCheckOutReason: reason, plannedCheckOutNote: note || null } });
    await logAudit({ entityType: "ACCOMMODATION", entityId: employee.bed.id, action: "UPDATE", after: { employeeId, scheduledCheckOut: date, reason, note }, userId: user.id, userName: user.name, branchId: employee.branchId });
    revalidateCampScreens(employeeId);
    return { scheduled: true, date };
  }

  const bed = await prisma.$transaction((tx) => checkOutNow(tx, { employeeId, date, reason, note: note || null }));
  await logAudit({ entityType: "ACCOMMODATION", entityId: employee.bed.id, action: "UPDATE", before: { employeeId, ...bed }, after: { employeeId: null, checkOutDate: date, reason, note }, userId: user.id, userName: user.name, branchId: employee.branchId });
  revalidateCampScreens(employeeId);
  return { date };
}

/** Cancels a scheduled checkout: the worker simply stays. */
export async function cancelScheduledCheckoutAction(employeeId: string): Promise<CheckoutResult> {
  await requirePermission("facilities", "edit");
  const { user, branchId, isSuperAdmin } = await requireUserWithBranch();
  const employee = await prisma.employee.findUnique({ where: { id: employeeId }, select: { branchId: true } });
  if (!employee || isOutsideBranch(employee.branchId, branchId, isSuperAdmin)) return { error: "You can't change that worker." };
  const open = await prisma.accommodationHistory.findFirst({ where: { employeeId, checkOutDate: null }, orderBy: { checkInDate: "desc" } });
  if (!open?.plannedCheckOutDate) return { error: "No checkout is scheduled." };
  await prisma.accommodationHistory.update({ where: { id: open.id }, data: { plannedCheckOutDate: null, plannedCheckOutReason: null, plannedCheckOutNote: null } });
  await logAudit({ entityType: "ACCOMMODATION", entityId: open.id, action: "UPDATE", before: { scheduledCheckOut: dayKey(open.plannedCheckOutDate) }, after: { scheduledCheckOut: null }, userId: user.id, userName: user.name, branchId: employee.branchId });
  revalidateCampScreens(employeeId);
  return {};
}

function revalidateCampScreens(employeeId: string) {
  revalidatePath("/accommodation/camps");
  revalidatePath("/accommodation/checkin");
  revalidatePath("/accommodation/bed-allocation");
  revalidatePath(`/employees/${employeeId}`);
}

/**
 * Removes a single bed. Beds could only be added, so a room created with the
 * wrong count had to be deleted and rebuilt.
 *
 * An occupied bed is kept: deleting it would drop the occupant's place without
 * closing their accommodation history, leaving them housed nowhere. Check the
 * worker out first, then the bed can go.
 */
export async function deleteBedAction(formData: FormData) {
  assertContactsValid(formData);
  await requirePermission("facilities", "delete");
  const { user, branchId, isSuperAdmin } = await requireUserWithBranch();
  const bedId = String(formData.get("bedId") || "");
  if (!bedId) return;
  const bedOwner = await bedBranch(bedId, { branchId, isSuperAdmin });
  if (bedOwner === undefined) return;

  const bed = await prisma.bed.findUnique({
    where: { id: bedId },
    include: { employee: { select: { name: true } }, room: { select: { name: true } } },
  });
  if (!bed) return;
  if (bed.employeeId) {
    redirect(
      `/accommodation/camps?error=${encodeURIComponent(
        `Can't delete bed ${bed.label} — ${bed.employee?.name ?? "someone"} is housed there. Check them out first.`
      )}`
    );
  }

  await prisma.bed.delete({ where: { id: bedId } });

  await logAudit({
    entityType: "BED",
    entityId: bedId,
    action: "DELETE",
    before: { roomId: bed.roomId, roomName: bed.room.name, label: bed.label },
    userId: user.id,
    userName: user.name,
    branchId: bedOwner,
  });

  revalidatePath("/accommodation/camps");
}

export async function deleteRoomAction(formData: FormData) {
  assertContactsValid(formData);
  await requirePermission("facilities", "delete");
  const { user, branchId, isSuperAdmin } = await requireUserWithBranch();
  const roomId = String(formData.get("roomId") || "");
  if (!roomId) return;
  const roomOwner = await roomBranch(roomId, { branchId, isSuperAdmin });
  if (roomOwner === undefined) return;

  const existing = await prisma.room.findUnique({ where: { id: roomId } });

  // Anyone bed-allocated in this room falls back to camp-only, not a stale
  // "bed allocated" status pointing at a bed that's about to stop existing.
  const affectedCheckInIds = (
    await prisma.campCheckIn.findMany({
      where: { bed: { roomId }, status: "BED_ALLOCATED" },
      select: { id: true },
    })
  ).map((c) => c.id);

  await prisma.room.delete({ where: { id: roomId } }); // cascades to its beds

  if (affectedCheckInIds.length > 0) {
    await prisma.campCheckIn.updateMany({
      where: { id: { in: affectedCheckInIds } },
      data: { status: "CHECKED_IN" },
    });
  }

  if (existing) {
    await logAudit({
      entityType: "ROOM",
      entityId: roomId,
      action: "DELETE",
      before: { campId: existing.campId, name: existing.name },
      userId: user.id,
      userName: user.name,
      branchId: roomOwner,
    });
  }

  revalidatePath("/accommodation/camps");
  revalidatePath("/accommodation/bed-allocation");
}

export async function deleteCampAction(formData: FormData) {
  assertContactsValid(formData);
  await requirePermission("facilities", "delete");
  const { user, branchId, isSuperAdmin } = await requireUserWithBranch();
  const campId = String(formData.get("campId") || "");
  if (!campId) return;
  const campOwner = await campBranch(campId, { branchId, isSuperAdmin });
  if (campOwner === undefined) return;

  const existing = await prisma.camp.findUnique({ where: { id: campId } });
  if (!existing) return;

  // Check-in slips reference the camp permanently (checkInNo is the audit
  // record), so a camp with any check-in history — even fully checked-out —
  // can't be deleted out from under it.
  const checkInCount = await prisma.campCheckIn.count({ where: { campId } });
  if (checkInCount > 0) {
    redirect(
      `/accommodation/camps?error=${encodeURIComponent(
        `Can't delete ${existing.name} — it has ${checkInCount} check-in record(s) on file.`
      )}`
    );
  }

  await prisma.camp.delete({ where: { id: campId } }); // cascades to rooms + beds

  if (existing) {
    await logAudit({
      entityType: "CAMP",
      entityId: campId,
      action: "DELETE",
      before: { name: existing.name },
      userId: user.id,
      userName: user.name,
      branchId: campOwner,
    });
  }

  revalidatePath("/accommodation/camps");
}

/**
 * Drag-and-drop on the camp map: put a worker on a vacant bed, moving them off
 * their current bed first if they have one. Keeps the same trail as a manual
 * allocation (accommodation history and the open check-in), so nothing the
 * check-in slip relies on goes missing.
 */
export async function placeWorkerInBedAction(employeeId: string, bedId: string): Promise<{ error?: string }> {
  const { user, branchId, isSuperAdmin } = await requireUserWithBranch();
  await settleDueCheckouts(branchId, user);
  const employee = await prisma.employee.findUnique({ where: { id: employeeId }, select: { branchId: true, name: true } });
  if (!employee || isOutsideBranch(employee.branchId, branchId, isSuperAdmin)) return { error: "You can't move that worker." };
  const bed = await prisma.bed.findUnique({ where: { id: bedId }, include: { room: { include: { camp: true } } } });
  if (!bed) return { error: "That bed no longer exists." };
  // Same rule as assignBedAction: the bed must be the caller's, and in the
  // worker's own branch. Checking only the worker let drag-and-drop place them
  // in another tenant's camp.
  if (isOutsideBranch(bed.room.camp.branchId, branchId, isSuperAdmin) || bed.room.camp.branchId !== employee.branchId) {
    return { error: "That bed no longer exists." };
  }
  if (bed.employeeId) return { error: bed.employeeId === employeeId ? "They're already in that bed." : "That bed was just taken." };

  try {
    await prisma.$transaction(async (tx) => {
      const current = await tx.bed.findUnique({ where: { employeeId } });
      if (current) {
        await tx.bed.update({ where: { id: current.id }, data: { employeeId: null } });
        const open = await tx.accommodationHistory.findFirst({ where: { employeeId, checkOutDate: null }, orderBy: { checkInDate: "desc" } });
        if (open) await tx.accommodationHistory.update({ where: { id: open.id }, data: { checkOutDate: new Date(), checkOutReason: "Moved to another bed" } });
      }
      await tx.bed.update({ where: { id: bedId }, data: { employeeId } });
      await tx.accommodationHistory.create({ data: { employeeId, campName: bed.room.camp.name, roomName: bed.room.name, bedLabel: bed.label } });
      const openCheckIn = await tx.campCheckIn.findFirst({ where: { employeeId, status: { in: ["CHECKED_IN", "BED_ALLOCATED"] } }, orderBy: { createdAt: "desc" } });
      if (openCheckIn) {
        await tx.campCheckIn.update({ where: { id: openCheckIn.id }, data: { campId: bed.room.campId, bedId, status: "BED_ALLOCATED" } });
      } else {
        await tx.campCheckIn.create({ data: { employeeId, campId: bed.room.campId, bedId, status: "BED_ALLOCATED", branchId: employee.branchId } });
      }
    });
  } catch {
    return { error: "Couldn't move them — the bed may have just been taken. Refresh and try again." };
  }

  await logAudit({
    entityType: "ACCOMMODATION",
    entityId: bedId,
    action: "UPDATE",
    after: { employeeId, campName: bed.room.camp.name, roomName: bed.room.name, bedLabel: bed.label },
    userId: user.id,
    userName: user.name,
    branchId,
  });
  revalidatePath("/accommodation/camps");
  revalidatePath("/accommodation/checkin");
  revalidatePath("/accommodation/bed-allocation");
  revalidatePath(`/employees/${employeeId}`);
  return {};
}
