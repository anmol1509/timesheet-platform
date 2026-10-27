"use server";

import { settleDueCheckouts } from "@/lib/accommodationCheckout";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireUserWithBranch, requireWrite, subjectOf } from "@/lib/auth";
import { canWrite } from "@/lib/permissions";
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
  const fullName = `${party.name}: ${name}`;
  // The camp belongs to the same branch as the supplier/client that owns it.
  // That party's branchId is always concrete, whereas scope.branchId is null
  // for a SUPER_ADMIN viewing all branches — which would leave the camp
  // unowned and invisible to every branch-scoped user.
  const camp = await prisma.camp.upsert({
    where: { branchId_name: { branchId: party.branchId, name: fullName } },
    create: {
      name: fullName,
      ownerType: campType,
      owningSupplierId: campType === "SUPPLIER" ? party.id : null,
      branchId: party.branchId,
    },
    update: {},
  });
  return { camp };
}

/**
 * The day a check-in is recorded for: today unless a date is given, and never a future one. Backdating is for
 * someone who was missed, so a date is accepted back as far as needed; a date one day ahead is tolerated because
 * the browser's "today" can be a day ahead of the server's in the Gulf.
 */
function checkInMoment(formData: FormData): { date: Date } | { error: string } {
  const raw = String(formData.get("checkInDate") || "").trim();
  if (!raw) return { date: new Date() };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw) || Number.isNaN(new Date(raw).getTime())) return { error: "Enter a valid check-in date." };
  const now = new Date();
  const tomorrow = new Date(now.getTime() + 86_400_000).toISOString().slice(0, 10);
  if (raw > tomorrow) return { error: "The check-in date can't be in the future." };
  return { date: raw === now.toISOString().slice(0, 10) ? now : new Date(raw) };
}

type CreatedCheckIn = { checkInId: string; employeeId: string; employeeName: string };

/** Places each selected employee into a camp and returns the new check-ins in the order they were selected. */
async function createCheckIns(
  formData: FormData
): Promise<{ created: CreatedCheckIn[]; camp: { id: string; name: string; branchId: string | null }; campType: string; date: Date; user: { id: string; name: string }; subject: ReturnType<typeof subjectOf>; branchId: string | null } | { error: string }> {
  await requireWrite("facilities.checkin");
  assertContactsValid(formData);
  const { user, branchId, isSuperAdmin } = await requireUserWithBranch();
  const campType = ["SUPPLIER", "CLIENT"].includes(String(formData.get("campType"))) ? String(formData.get("campType")) : "OWN";
  const employeeIds = formData.getAll("employeeId").map(String).filter(Boolean);
  if (employeeIds.length === 0) return { error: "Select at least one employee." };
  const moment = checkInMoment(formData);
  if ("error" in moment) return { error: moment.error };

  // Own camps are picked from the list. Supplier and client camps aren't managed here (no rooms or beds),
  // so they are recorded by name against the supplier or client, and reused next time.
  let camp: { id: string; name: string } | null = null;
  if (campType === "OWN") {
    const own = await prisma.camp.findUnique({ where: { id: String(formData.get("campId") || "") } });
    if (!own || own.ownerType !== "OWN" || isOutsideBranch(own.branchId, branchId, isSuperAdmin)) return { error: "Select one of your own camps." };
    camp = own;
  } else {
    const resolved = await resolveExternalCamp(campType as "SUPPLIER" | "CLIENT", String(formData.get("partyId") || ""), String(formData.get("campName") || ""), { branchId, isSuperAdmin });
    if ("error" in resolved) return { error: resolved.error };
    camp = resolved.camp;
  }
  const campId = camp.id;
  const campBranchId = (await prisma.camp.findUnique({ where: { id: campId }, select: { branchId: true } }))?.branchId ?? null;

  const employees = await prisma.employee.findMany({
    where: { id: { in: employeeIds } },
    select: { id: true, name: true, branchId: true, bed: { select: { id: true } } },
  });

  const created: CreatedCheckIn[] = [];
  for (const employeeId of employeeIds) {
    const employee = employees.find((e) => e.id === employeeId);
    if (!employee || isOutsideBranch(employee.branchId, branchId, isSuperAdmin)) continue;
    // A worker is only ever placed in a camp of their own branch — this holds for
    // a super admin too, who could otherwise check one tenant's people into another's.
    if (employee.branchId !== campBranchId) continue;
    // Already housed, or already checked into a camp — neither belongs here.
    if (employee.bed) continue;
    const alreadyOpen = await prisma.campCheckIn.findFirst({
      where: { employeeId, status: { in: ["CHECKED_IN", "BED_ALLOCATED"] } },
    });
    if (alreadyOpen) continue;

    const row = await prisma.campCheckIn.create({
      data: { employeeId, campId, branchId: employee.branchId, checkInDate: moment.date },
    });
    created.push({ checkInId: row.id, employeeId, employeeName: employee.name });

    await logAudit({
      entityType: "CAMP_CHECK_IN",
      entityId: row.id,
      action: "CREATE",
      after: { employeeId, employeeName: employee.name, campId, campName: camp.name, checkInNo: row.checkInNo, checkInDate: moment.date },
      userId: user.id,
      userName: user.name,
      branchId: employee.branchId,
    });
  }

  if (created.length === 0) return { error: "None of the selected employees could be checked in." };
  return { created, camp: { ...camp, branchId: campBranchId }, campType, date: moment.date, user, subject: subjectOf(user), branchId };
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
  const r = await createCheckIns(formData);
  if ("error" in r) return r;
  revalidateAccommodation();
  return { ids: r.created.map((c) => c.checkInId) };
}

export type CheckInAndAssignResult = { ids: string[]; assigned: { employeeName: string; bedLabel: string }[]; waiting: number };

/**
 * Check-in and bed in one step, for an own camp. The workers are checked in as above; when beds are wanted each
 * gets the bed chosen for them (field `bedId:<employeeId>`), and anyone without a valid choice takes the next
 * vacant bed in order, room by room. If there are fewer vacant beds than workers the rest stay checked in and
 * waiting for Bed Allocation. Needs the Bed Allocation permission to place beds; without it people are only
 * checked in.
 */
export async function checkInAndAssignAction(formData: FormData): Promise<CheckInAndAssignResult | { error: string }> {
  const r = await createCheckIns(formData);
  if ("error" in r) return r;
  const { created, camp, campType, date, user, subject, branchId } = r;
  const assigned: { employeeName: string; bedLabel: string }[] = [];

  const wantsBeds = formData.get("assignBeds") === "1" && campType === "OWN" && canWrite(subject, "facilities.bed-allocation");
  if (wantsBeds) {
    await settleDueCheckouts(branchId, user);
    const natural = (a: string, b: string) => a.localeCompare(b, undefined, { numeric: true });
    const vacant = (await prisma.bed.findMany({ where: { employeeId: null, room: { campId: camp.id } }, include: { room: { select: { name: true } } } })).sort(
      (a, b) => natural(a.room.name, b.room.name) || natural(a.label, b.label)
    );
    const used = new Set<string>();
    const nextFree = () => vacant.find((b) => !used.has(b.id));
    for (const c of created) {
      const wanted = String(formData.get(`bedId:${c.employeeId}`) || "");
      const bed = vacant.find((b) => b.id === wanted && !used.has(b.id)) ?? nextFree();
      if (!bed) break;
      used.add(bed.id);
      try {
        await prisma.$transaction(async (tx) => {
          const fresh = await tx.bed.findUnique({ where: { id: bed.id }, select: { employeeId: true } });
          if (fresh?.employeeId) throw new Error("taken");
          await tx.bed.update({ where: { id: bed.id }, data: { employeeId: c.employeeId } });
          await tx.accommodationHistory.create({ data: { employeeId: c.employeeId, campName: camp.name, roomName: bed.room.name, bedLabel: bed.label, checkInDate: date } });
          await tx.campCheckIn.update({ where: { id: c.checkInId }, data: { bedId: bed.id, status: "BED_ALLOCATED" } });
        });
      } catch {
        continue; // someone else took the bed a moment ago: they stay checked in, waiting for a bed
      }
      assigned.push({ employeeName: c.employeeName, bedLabel: `${bed.room.name} · ${bed.label}` });
      await logAudit({
        entityType: "ACCOMMODATION",
        entityId: bed.id,
        action: "UPDATE",
        after: { employeeId: c.employeeId, campName: camp.name, roomName: bed.room.name, bedLabel: bed.label, checkInDate: date },
        userId: user.id,
        userName: user.name,
        branchId,
      });
    }
  }

  revalidateAccommodation();
  for (const c of created) revalidatePath(`/employees/${c.employeeId}`);
  return { ids: created.map((c) => c.checkInId), assigned, waiting: created.length - assigned.length };
}

/**
 * Gives every worker who is checked in to an own camp but has no bed the next vacant bed in that
 * camp, in the order they were checked in. Optionally limited to one camp.
 */
export async function autoAssignWaitingAction(campId?: string): Promise<{ assigned: number; waiting: number } | { error: string }> {
  const { user, branchId, isSuperAdmin } = await requireUserWithBranch();
  const subject = subjectOf(user);
  if (!canWrite(subject, "facilities.bed-allocation")) return { error: "You don't have permission to allocate beds." };
  await settleDueCheckouts(branchId, user);
  const natural = (a: string, b: string) => a.localeCompare(b, undefined, { numeric: true });
  const waitingRows = await prisma.campCheckIn.findMany({
    where: { status: "CHECKED_IN", bedId: null, camp: { ownerType: "OWN", ...(campId ? { id: campId } : {}) } },
    include: { camp: { select: { id: true, name: true, branchId: true } }, employee: { select: { id: true, name: true, branchId: true } } },
    orderBy: { checkInDate: "asc" },
  });
  const rows = waitingRows.filter((c) => !isOutsideBranch(c.camp.branchId, branchId, isSuperAdmin));
  const vacantByCamp = new Map<string, Awaited<ReturnType<typeof prisma.bed.findMany<{ include: { room: { select: { name: true } } } }>>>>();
  let assigned = 0;
  for (const c of rows) {
    if (!vacantByCamp.has(c.camp.id)) {
      const beds = await prisma.bed.findMany({ where: { employeeId: null, room: { campId: c.camp.id } }, include: { room: { select: { name: true } } } });
      vacantByCamp.set(c.camp.id, beds.sort((a, b) => natural(a.room.name, b.room.name) || natural(a.label, b.label)));
    }
    const bed = vacantByCamp.get(c.camp.id)!.shift();
    if (!bed) continue;
    try {
      await prisma.$transaction(async (tx) => {
        const fresh = await tx.bed.findUnique({ where: { id: bed.id }, select: { employeeId: true } });
        const already = await tx.bed.findFirst({ where: { employeeId: c.employeeId }, select: { id: true } });
        if (fresh?.employeeId || already) throw new Error("taken");
        await tx.bed.update({ where: { id: bed.id }, data: { employeeId: c.employeeId } });
        await tx.accommodationHistory.create({ data: { employeeId: c.employeeId, campName: c.camp.name, roomName: bed.room.name, bedLabel: bed.label, checkInDate: c.checkInDate } });
        await tx.campCheckIn.update({ where: { id: c.id }, data: { bedId: bed.id, status: "BED_ALLOCATED" } });
      });
    } catch {
      continue;
    }
    assigned++;
    await logAudit({
      entityType: "ACCOMMODATION",
      entityId: bed.id,
      action: "UPDATE",
      after: { employeeId: c.employeeId, campName: c.camp.name, roomName: bed.room.name, bedLabel: bed.label },
      userId: user.id,
      userName: user.name,
      branchId,
    });
    revalidatePath(`/employees/${c.employeeId}`);
  }
  revalidateAccommodation();
  return { assigned, waiting: rows.length - assigned };
}

// Moves an employee to a different camp before a bed has been picked. If a
// bed was already allocated in the old camp, it's freed first — a bed
// belongs to a specific camp's room, so it can't follow the switch.
export async function switchCampAction(formData: FormData) {
  await requireWrite("facilities");
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
  if (!newCamp || isOutsideBranch(newCamp.branchId, branchId, isSuperAdmin) || newCamp.branchId !== checkIn.employee.branchId) return;

  await prisma.$transaction(async (tx) => {
    if (checkIn.bedId && checkIn.bed) {
      await tx.bed.update({ where: { id: checkIn.bedId }, data: { employeeId: null } });
      const openHistory = await tx.accommodationHistory.findFirst({
        where: { employeeId: checkIn.employeeId, checkOutDate: null },
        orderBy: { checkInDate: "desc" },
      });
      if (openHistory) {
        await tx.accommodationHistory.update({ where: { id: openHistory.id }, data: { checkOutDate: new Date(), checkOutReason: "Moved to another bed or camp" } });
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
  await requireWrite("facilities.bed-allocation");
  assertContactsValid(formData);
  const { user, branchId, isSuperAdmin } = await requireUserWithBranch();
  await settleDueCheckouts(branchId, user);
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
  if (isOutsideBranch(bed.room.camp.branchId, branchId, isSuperAdmin) || bed.room.camp.branchId !== checkIn.employee.branchId) return;
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
        await tx.accommodationHistory.update({ where: { id: openHistory.id }, data: { checkOutDate: new Date(), checkOutReason: "Moved to another bed or camp" } });
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
  await requireWrite("facilities");
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
