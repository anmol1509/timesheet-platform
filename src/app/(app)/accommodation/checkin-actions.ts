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
 * A camp run by a supplier or a client is recorded by name against that party (there are no rooms or
 * beds to manage). Finds it or creates it, so typing the same name again reuses the same camp.
 */
async function resolveExternalCamp(
  campType: "SUPPLIER" | "CLIENT",
  partyId: string,
  campName: string,
  scope: { branchId: string | null; isSuperAdmin: boolean }
): Promise<{ camp: { id: string; name: string } } | { error: string }> {
  const name = campName.trim().slice(0, 80);
  const party =
    campType === "SUPPLIER"
      ? await prisma.supplier.findUnique({ where: { id: partyId }, select: { id: true, name: true, branchId: true } })
      : await prisma.client.findUnique({ where: { id: partyId }, select: { id: true, name: true, branchId: true } });
  if (!party || isOutsideBranch(party.branchId, scope.branchId, scope.isSuperAdmin)) return { error: `Choose the ${campType === "SUPPLIER" ? "supplier" : "client"}.` };
  if (!name) return { error: "Enter the camp name or location." };
  const fullName = `${party.name} — ${name}`;
  const camp = await prisma.camp.upsert({
    where: { name: fullName },
    create: { name: fullName, ownerType: campType, owningSupplierId: campType === "SUPPLIER" ? party.id : null },
    update: {},
  });
  return { camp };
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
  assertContactsValid(formData);
  const { user, branchId, isSuperAdmin } = await requireUserWithBranch();
  const campType = ["SUPPLIER", "CLIENT"].includes(String(formData.get("campType"))) ? String(formData.get("campType")) : "OWN";
  const employeeIds = formData.getAll("employeeId").map(String).filter(Boolean);
  if (employeeIds.length === 0) return { error: "Select at least one employee." };

  // Own camps are picked from the list. Supplier and client camps aren't managed here (no rooms or beds),
  // so they are recorded by name against the supplier or client, and reused next time.
  let camp: { id: string; name: string } | null = null;
  if (campType === "OWN") {
    const own = await prisma.camp.findUnique({ where: { id: String(formData.get("campId") || "") } });
    if (!own || own.ownerType !== "OWN") return { error: "Select one of your own camps." };
    camp = own;
  } else {
    const resolved = await resolveExternalCamp(campType as "SUPPLIER" | "CLIENT", String(formData.get("partyId") || ""), String(formData.get("campName") || ""), { branchId, isSuperAdmin });
    if ("error" in resolved) return { error: resolved.error };
    camp = resolved.camp;
  }
  const campId = camp.id;

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
  // The bed may be in a different own camp than the one checked into; the check-in then follows the bed.
  if (!bed || bed.room.camp.ownerType !== "OWN") return;
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
    await tx.campCheckIn.update({ where: { id: checkInId }, data: { bedId, campId: bed.room.campId, status: "BED_ALLOCATED" } });
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

/**
 * "Switch camp / room" to a supplier's or a client's camp: the worker leaves their bed (it is freed) and is
 * recorded against that camp by name, with no room or bed. Reuses switchCampAction for the move itself.
 */
export async function switchToExternalCampAction(formData: FormData): Promise<{ error?: string }> {
  assertContactsValid(formData);
  const { branchId, isSuperAdmin } = await requireUserWithBranch();
  const campType = String(formData.get("campType"));
  if (campType !== "SUPPLIER" && campType !== "CLIENT") return { error: "Choose a supplier or client camp." };
  const resolved = await resolveExternalCamp(campType, String(formData.get("partyId") || ""), String(formData.get("campName") || ""), { branchId, isSuperAdmin });
  if ("error" in resolved) return { error: resolved.error };
  const checkInId = String(formData.get("checkInId") || "");
  const fd = new FormData();
  fd.set("checkInId", checkInId);
  fd.set("campId", resolved.camp.id);
  await switchCampAction(fd);
  // The check-in date is kept (and can be corrected) when moving to a supplier's or client's camp.
  const date = dateOrNull(formData.get("checkInDate"));
  if (date && !Number.isNaN(date.getTime())) {
    const ci = await prisma.campCheckIn.findUnique({ where: { id: checkInId }, select: { employee: { select: { branchId: true } } } });
    if (ci && !isOutsideBranch(ci.employee.branchId, branchId, isSuperAdmin)) await prisma.campCheckIn.update({ where: { id: checkInId }, data: { checkInDate: date } });
  }
  revalidateAccommodation();
  return {};
}
