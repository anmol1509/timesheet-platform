"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireUser, requireUserWithBranch } from "@/lib/auth";
import { isOutsideBranch } from "@/lib/branch";
import { logAudit } from "@/lib/audit";

export async function createCampAction(formData: FormData) {
  const user = await requireUser();
  const name = String(formData.get("name") || "").trim();
  if (!name) return;
  const created = await prisma.camp.create({ data: { name } });

  await logAudit({
    entityType: "CAMP",
    entityId: created.id,
    action: "CREATE",
    after: { name },
    userId: user.id,
    userName: user.name,
    branchId: null,
  });

  revalidatePath("/accommodation");
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

  revalidatePath("/accommodation");
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

  revalidatePath("/accommodation");
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

  revalidatePath("/accommodation");
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

  revalidatePath("/accommodation");
}

// Beds/rooms/camps themselves aren't branch-scoped yet — only the employee
// being assigned/unassigned needs to belong to the caller's branch.
export async function assignBedAction(formData: FormData) {
  const { user, branchId, isSuperAdmin } = await requireUserWithBranch();
  const bedId = String(formData.get("bedId") || "");
  const employeeId = String(formData.get("employeeId") || "");
  if (!bedId || !employeeId) return;
  const employee = await prisma.employee.findUnique({ where: { id: employeeId }, select: { branchId: true } });
  if (!employee || isOutsideBranch(employee.branchId, branchId, isSuperAdmin)) return;

  const bed = await prisma.bed.update({
    where: { id: bedId },
    data: { employeeId },
    include: { room: { include: { camp: true } } },
  });

  await prisma.accommodationHistory.create({
    data: {
      employeeId,
      campName: bed.room.camp.name,
      roomName: bed.room.name,
      bedLabel: bed.label,
    },
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

  revalidatePath("/accommodation");
  revalidatePath(`/employees/${employeeId}`);
}

// Pairs each selected employee (in order) with the room's next vacant bed.
// More selected employees than vacant beds is a soft cap, not an error —
// the caller gets back how many actually got assigned so the UI can report
// "N of M checked in, room is now full" rather than failing the batch.
export async function bulkCheckInAction(
  formData: FormData
): Promise<{ assigned: number; requested: number }> {
  const { user, branchId, isSuperAdmin } = await requireUserWithBranch();
  const roomId = String(formData.get("roomId") || "");
  const employeeIds = formData.getAll("employeeId").map(String).filter(Boolean);
  if (!roomId || employeeIds.length === 0) return { assigned: 0, requested: employeeIds.length };

  const vacantBeds = await prisma.bed.findMany({
    where: { roomId, employeeId: null },
    include: { room: { include: { camp: true } } },
    orderBy: { label: "asc" },
  });

  let assigned = 0;
  for (const employeeId of employeeIds) {
    const bed = vacantBeds[assigned];
    if (!bed) break;

    const employee = await prisma.employee.findUnique({ where: { id: employeeId }, select: { branchId: true } });
    if (!employee || isOutsideBranch(employee.branchId, branchId, isSuperAdmin)) continue;

    await prisma.bed.update({ where: { id: bed.id }, data: { employeeId } });

    await prisma.accommodationHistory.create({
      data: {
        employeeId,
        campName: bed.room.camp.name,
        roomName: bed.room.name,
        bedLabel: bed.label,
      },
    });

    await logAudit({
      entityType: "ACCOMMODATION",
      entityId: bed.id,
      action: "UPDATE",
      after: { employeeId, campName: bed.room.camp.name, roomName: bed.room.name, bedLabel: bed.label },
      userId: user.id,
      userName: user.name,
      branchId,
    });

    revalidatePath(`/employees/${employeeId}`);
    assigned++;
  }

  revalidatePath("/accommodation");
  return { assigned, requested: employeeIds.length };
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
    const openHistory = await prisma.accommodationHistory.findFirst({
      where: { employeeId, checkOutDate: null },
      orderBy: { checkInDate: "desc" },
    });
    if (openHistory) {
      await prisma.accommodationHistory.update({
        where: { id: openHistory.id },
        data: { checkOutDate: new Date() },
      });
    }

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

  revalidatePath("/accommodation");
  if (employeeId) revalidatePath(`/employees/${employeeId}`);
}

export async function deleteRoomAction(formData: FormData) {
  const user = await requireUser();
  const roomId = String(formData.get("roomId") || "");
  if (!roomId) return;

  const existing = await prisma.room.findUnique({ where: { id: roomId } });
  await prisma.room.delete({ where: { id: roomId } }); // cascades to its beds

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

  revalidatePath("/accommodation");
}

export async function deleteCampAction(formData: FormData) {
  const user = await requireUser();
  const campId = String(formData.get("campId") || "");
  if (!campId) return;

  const existing = await prisma.camp.findUnique({ where: { id: campId } });
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

  revalidatePath("/accommodation");
}
