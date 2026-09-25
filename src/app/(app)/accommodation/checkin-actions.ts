"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireUserWithBranch } from "@/lib/auth";
import { isOutsideBranch } from "@/lib/branch";
import { logAudit } from "@/lib/audit";
import { assertContactsValid } from "@/lib/validators";

function dateOrNull(value: FormDataEntryValue | null) {
  const s = String(value || "").trim();
  return s ? new Date(s) : null;
}

function revalidateAccommodation(employeeId?: string) {
  revalidatePath("/accommodation/camps");
  revalidatePath("/accommodation/checkin");
  revalidatePath("/accommodation/bed-allocation");
  if (employeeId) revalidatePath(`/employees/${employeeId}`);
}

/**
 * Stage 1 of the two-stage check-in flow: places each selected employee into
 * a camp (no room/bed yet — that's Bed Allocation). Produces a CampCheckIn
 * per employee with a printable checkInNo, and returns the ids so the caller
 * can immediately open the check-in slip PDF.
 */
export async function createCheckInAction(
  formData: FormData
): Promise<{ ids: string[] } | { error: string }> {
  const { user, branchId, isSuperAdmin } = await requireUserWithBranch();
  const campId = String(formData.get("campId") || "");
  const employeeIds = formData.getAll("employeeId").map(String).filter(Boolean);
  if (!campId) return { error: "Select a camp." };
  if (employeeIds.length === 0) return { error: "Select at least one employee." };

  const camp = await prisma.camp.findUnique({ where: { id: campId } });
  if (!camp) return { error: "Camp not found." };

  const employees = await prisma.employee.findMany({
    where: { id: { in: employeeIds } },
    select: { id: true, name: true, branchId: true, bed: { select: { id: true } } },
  });

  const ids: string[] = [];
  for (const employeeId of employeeIds) {
    const employee = employees.find((e) => e.id === employeeId);
    if (!employee || isOutsideBranch(employee.branchId, branchId, isSuperAdmin)) continue;
    // Already housed, or already checked into a camp — neither belongs here.
    if (employee.bed) continue;
    const alreadyOpen = await prisma.campCheckIn.findFirst({
      where: { employeeId, status: { in: ["CHECKED_IN", "BED_ALLOCATED"] } },
    });
    if (alreadyOpen) continue;

    const created = await prisma.campCheckIn.create({
      data: { employeeId, campId, branchId: employee.branchId },
    });
    ids.push(created.id);

    await logAudit({
      entityType: "CAMP_CHECK_IN",
      entityId: created.id,
      action: "CREATE",
      after: { employeeId, employeeName: employee.name, campId, campName: camp.name, checkInNo: created.checkInNo },
      userId: user.id,
      userName: user.name,
      branchId: employee.branchId,
    });
  }

  if (ids.length === 0) return { error: "None of the selected employees could be checked in." };

  revalidateAccommodation();
  return { ids };
}

// Moves an employee to a different camp before a bed has been picked. If a
// bed was already allocated in the old camp, it's freed first — a bed
// belongs to a specific camp's room, so it can't follow the switch.
export async function switchCampAction(formData: FormData) {
  assertContactsValid(formData);
  const { user, branchId, isSuperAdmin } = await requireUserWithBranch();
  const checkInId = String(formData.get("checkInId") || "");
  const newCampId = String(formData.get("campId") || "");
  if (!checkInId || !newCampId) return;

  const checkIn = await prisma.campCheckIn.findUnique({
    where: { id: checkInId },
    include: {
      employee: { select: { id: true, name: true, branchId: true } },
      camp: { select: { name: true } },
      bed: { include: { room: { include: { camp: true } } } },
    },
  });
  if (!checkIn || isOutsideBranch(checkIn.employee.branchId, branchId, isSuperAdmin)) return;
  if (checkIn.campId === newCampId) return;

  const newCamp = await prisma.camp.findUnique({ where: { id: newCampId } });
  if (!newCamp) return;

  await prisma.$transaction(async (tx) => {
    if (checkIn.bedId && checkIn.bed) {
      await tx.bed.update({ where: { id: checkIn.bedId }, data: { employeeId: null } });
      const openHistory = await tx.accommodationHistory.findFirst({
        where: { employeeId: checkIn.employeeId, checkOutDate: null },
        orderBy: { checkInDate: "desc" },
      });
      if (openHistory) {
        await tx.accommodationHistory.update({ where: { id: openHistory.id }, data: { checkOutDate: new Date() } });
      }
    }

    await tx.campCheckIn.update({
      where: { id: checkInId },
      data: { campId: newCampId, bedId: null, status: "CHECKED_IN" },
    });
  });

  await logAudit({
    entityType: "CAMP_CHECK_IN",
    entityId: checkInId,
    action: "UPDATE",
    before: { campName: checkIn.camp.name },
    after: { campName: newCamp.name },
    userId: user.id,
    userName: user.name,
    branchId,
  });

  revalidateAccommodation(checkIn.employee.id);
}

// Stage 2: picks the actual bed. Also handles moving someone already
// bed-allocated to a different bed ("Switch Room") — the old bed is freed
// and its accommodation history closed before the new one opens.
export async function allocateBedAction(formData: FormData) {
  assertContactsValid(formData);
  const { user, branchId, isSuperAdmin } = await requireUserWithBranch();
  const checkInId = String(formData.get("checkInId") || "");
  const bedId = String(formData.get("bedId") || "");
  const checkInDate = dateOrNull(formData.get("checkInDate")) || new Date();
  if (!checkInId || !bedId) return;

  const checkIn = await prisma.campCheckIn.findUnique({
    where: { id: checkInId },
    include: { employee: { select: { id: true, branchId: true } } },
  });
  if (!checkIn || isOutsideBranch(checkIn.employee.branchId, branchId, isSuperAdmin)) return;

  const bed = await prisma.bed.findUnique({ where: { id: bedId }, include: { room: { include: { camp: true } } } });
  if (!bed || bed.room.campId !== checkIn.campId) return;
  if (bed.employeeId && bed.employeeId !== checkIn.employeeId) return; // occupied by someone else

  const employeeId = checkIn.employeeId;

  await prisma.$transaction(async (tx) => {
    if (checkIn.bedId && checkIn.bedId !== bedId) {
      await tx.bed.update({ where: { id: checkIn.bedId }, data: { employeeId: null } });
      const openHistory = await tx.accommodationHistory.findFirst({
        where: { employeeId, checkOutDate: null },
        orderBy: { checkInDate: "desc" },
      });
      if (openHistory) {
        await tx.accommodationHistory.update({ where: { id: openHistory.id }, data: { checkOutDate: new Date() } });
      }
    }

    await tx.bed.update({ where: { id: bedId }, data: { employeeId } });
    await tx.accommodationHistory.create({
      data: {
        employeeId,
        campName: bed.room.camp.name,
        roomName: bed.room.name,
        bedLabel: bed.label,
        checkInDate,
      },
    });
    await tx.campCheckIn.update({ where: { id: checkInId }, data: { bedId, status: "BED_ALLOCATED" } });
  });

  await logAudit({
    entityType: "ACCOMMODATION",
    entityId: bedId,
    action: "UPDATE",
    after: {
      employeeId,
      campName: bed.room.camp.name,
      roomName: bed.room.name,
      bedLabel: bed.label,
      checkInDate,
    },
    userId: user.id,
    userName: user.name,
    branchId,
  });

  revalidateAccommodation(employeeId);
}
