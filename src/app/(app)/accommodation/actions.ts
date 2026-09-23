"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireUser, requireUserWithBranch, requirePermission } from "@/lib/auth";
import { isOutsideBranch } from "@/lib/branch";
import { logAudit } from "@/lib/audit";

type RoomSpec = { name: string; bedCount: number };

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
      bedCount: Math.max(1, Math.min(20, Number((r as { bedCount?: unknown })?.bedCount) || 1)),
    }))
    .filter((r) => r.name.length > 0);
}

// Asks for the camp's full room/bed layout up front, rather than an empty
// camp a user then has to add rooms to one at a time.
export async function createCampWithRoomsAction(
  formData: FormData
): Promise<{ campId: string } | { error: string }> {
  const user = await requireUser();
  const name = String(formData.get("name") || "").trim();
  const ownerType = String(formData.get("ownerType") || "OWN") === "SUPPLIER" ? "SUPPLIER" : "OWN";
  const owningSupplierId = ownerType === "SUPPLIER" ? stringOrNull(formData.get("supplierId")) : null;
  const rooms = parseRoomSpecs(formData.get("roomsJson"));
  if (!name) return { error: "Camp name is required." };
  if (rooms.length === 0) return { error: "Add at least one room." };

  let campId: string;
  try {
    campId = await prisma.$transaction(async (tx) => {
      const camp = await tx.camp.create({ data: { name, ownerType, owningSupplierId } });
      for (const room of rooms) {
        const createdRoom = await tx.room.create({
          data: { campId: camp.id, name: room.name, bedSpace: room.bedCount, usableBedSpace: room.bedCount },
        });
        await tx.bed.createMany({
          data: Array.from({ length: room.bedCount }, (_, i) => ({
            roomId: createdRoom.id,
            label: `Bed ${String(i + 1).padStart(2, "0")}`,
          })),
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
    branchId: null,
  });

  revalidatePath("/accommodation/camps");
  return { campId };
}

export async function updateCampOwnershipAction(formData: FormData) {
  const user = await requireUser();
  const campId = String(formData.get("campId") || "");
  const ownerType = String(formData.get("ownerType") || "OWN") === "SUPPLIER" ? "SUPPLIER" : "OWN";
  const owningSupplierId = ownerType === "SUPPLIER" ? stringOrNull(formData.get("supplierId")) : null;
  if (!campId) return;

  const before = await prisma.camp.findUnique({ where: { id: campId } });
  await prisma.camp.update({ where: { id: campId }, data: { ownerType, owningSupplierId } });

  await logAudit({
    entityType: "CAMP",
    entityId: campId,
    action: "UPDATE",
    before: before as unknown as Record<string, unknown>,
    after: { ownerType, owningSupplierId },
    userId: user.id,
    userName: user.name,
    branchId: null,
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
  const user = await requireUser();
  const campId = String(formData.get("campId") || "");
  const name = String(formData.get("name") || "").trim();
  const bedCount = Math.max(1, Math.min(20, Number(formData.get("bedCount")) || 1));
  const bedSpace = intOrNull(formData.get("bedSpace"));
  const usableBedSpace = intOrNull(formData.get("usableBedSpace"));
  const roomType = stringOrNull(formData.get("roomType"));
  const nationality = stringOrNull(formData.get("nationality"));
  if (!campId || !name) return;

  const room = await prisma.room.create({
    data: { campId, name, bedSpace, usableBedSpace, roomType, nationality },
  });
  await prisma.bed.createMany({
    data: Array.from({ length: bedCount }, (_, i) => ({
      roomId: room.id,
      label: `Bed ${String(i + 1).padStart(2, "0")}`,
    })),
  });

  await logAudit({
    entityType: "ROOM",
    entityId: room.id,
    action: "CREATE",
    after: { campId, name, bedCount, bedSpace, usableBedSpace, roomType, nationality },
    userId: user.id,
    userName: user.name,
    branchId: null,
  });

  revalidatePath("/accommodation/camps");
}

export async function updateCampAction(formData: FormData) {
  const user = await requireUser();
  const campId = String(formData.get("campId") || "");
  const name = String(formData.get("name") || "").trim();
  if (!campId || !name) return;

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
    branchId: null,
  });

  revalidatePath("/accommodation/camps");
}

export async function updateRoomAction(formData: FormData) {
  const user = await requireUser();
  const roomId = String(formData.get("roomId") || "");
  const name = String(formData.get("name") || "").trim();
  if (!roomId || !name) return;

  const before = await prisma.room.findUnique({ where: { id: roomId } });
  await prisma.room.update({ where: { id: roomId }, data: { name } });

  await logAudit({
    entityType: "ROOM",
    entityId: roomId,
    action: "UPDATE",
    before: before as unknown as Record<string, unknown>,
    after: { name },
    userId: user.id,
    userName: user.name,
    branchId: null,
  });

  revalidatePath("/accommodation/camps");
}

export async function addBedsToRoomAction(formData: FormData) {
  await requireUser();
  const roomId = String(formData.get("roomId") || "");
  const count = Math.max(1, Math.min(20, Number(formData.get("count")) || 1));
  if (!roomId) return;

  const existingBeds = await prisma.bed.count({ where: { roomId } });
  await prisma.bed.createMany({
    data: Array.from({ length: count }, (_, i) => ({
      roomId,
      label: `Bed ${String(existingBeds + i + 1).padStart(2, "0")}`,
    })),
  });

  revalidatePath("/accommodation/camps");
}

// Beds/rooms/camps themselves aren't branch-scoped yet — only the employee
// being assigned/unassigned needs to belong to the caller's branch.
//
// A direct bed assignment (from the Employee profile's own Accommodation
// section, bypassing Create Check-In/Bed Allocation) still needs a
// CampCheckIn row behind it, or the employee would show a bed but never
// appear "checked in" anywhere — so one is opened (or reused/moved) here too.
export async function assignBedAction(formData: FormData) {
  const { user, branchId, isSuperAdmin } = await requireUserWithBranch();
  const bedId = String(formData.get("bedId") || "");
  const employeeId = String(formData.get("employeeId") || "");
  if (!bedId || !employeeId) return;
  const employee = await prisma.employee.findUnique({ where: { id: employeeId }, select: { branchId: true } });
  if (!employee || isOutsideBranch(employee.branchId, branchId, isSuperAdmin)) return;

  const bed = await prisma.bed.findUnique({ where: { id: bedId }, include: { room: { include: { camp: true } } } });
  if (!bed) return;

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

export async function unassignBedAction(formData: FormData) {
  const { user, branchId, isSuperAdmin } = await requireUserWithBranch();
  const bedId = String(formData.get("bedId") || "");
  const employeeId = String(formData.get("employeeId") || "");
  if (!bedId) return;
  if (employeeId) {
    const employee = await prisma.employee.findUnique({ where: { id: employeeId }, select: { branchId: true } });
    if (!employee || isOutsideBranch(employee.branchId, branchId, isSuperAdmin)) return;
  }

  const bed = await prisma.bed.update({
    where: { id: bedId },
    data: { employeeId: null },
    include: { room: { include: { camp: true } } },
  });

  if (employeeId) {
    await prisma.$transaction(async (tx) => {
      const openHistory = await tx.accommodationHistory.findFirst({
        where: { employeeId, checkOutDate: null },
        orderBy: { checkInDate: "desc" },
      });
      if (openHistory) {
        await tx.accommodationHistory.update({
          where: { id: openHistory.id },
          data: { checkOutDate: new Date() },
        });
      }

      const openCheckIn = await tx.campCheckIn.findFirst({
        where: { employeeId, status: { in: ["CHECKED_IN", "BED_ALLOCATED"] } },
        orderBy: { createdAt: "desc" },
      });
      if (openCheckIn) {
        await tx.campCheckIn.update({
          where: { id: openCheckIn.id },
          data: { status: "CHECKED_OUT", checkOutDate: new Date(), bedId: null },
        });
      }
    });

    await logAudit({
      entityType: "ACCOMMODATION",
      entityId: bedId,
      action: "UPDATE",
      before: { employeeId, campName: bed.room.camp.name, roomName: bed.room.name, bedLabel: bed.label },
      after: { employeeId: null },
      userId: user.id,
      userName: user.name,
      branchId,
    });
  }

  revalidatePath("/accommodation/camps");
  revalidatePath("/accommodation/checkin");
  revalidatePath("/accommodation/bed-allocation");
  if (employeeId) revalidatePath(`/employees/${employeeId}`);
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
  await requirePermission("facilities", "delete");
  const user = await requireUser();
  const bedId = String(formData.get("bedId") || "");
  if (!bedId) return;

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
    branchId: null,
  });

  revalidatePath("/accommodation/camps");
}

export async function deleteRoomAction(formData: FormData) {
  await requirePermission("facilities", "delete");
  const user = await requireUser();
  const roomId = String(formData.get("roomId") || "");
  if (!roomId) return;

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
      branchId: null,
    });
  }

  revalidatePath("/accommodation/camps");
  revalidatePath("/accommodation/bed-allocation");
}

export async function deleteCampAction(formData: FormData) {
  await requirePermission("facilities", "delete");
  const user = await requireUser();
  const campId = String(formData.get("campId") || "");
  if (!campId) return;

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
      branchId: null,
    });
  }

  revalidatePath("/accommodation/camps");
}
