import { prisma } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";
import { logAudit } from "@/lib/audit";
import { dayKey, todayKey } from "@/lib/checkoutReasons";

type Tx = Prisma.TransactionClient;

/** The moment stored for a checkout date: right now for today, otherwise midday UTC so the calendar day is the same everywhere. */
const stamp = (date: string) => (date === todayKey() ? new Date() : new Date(`${date}T12:00:00Z`));

/**
 * Frees the worker's bed and closes their stay on the given date, with the reason.
 * Returns what the bed was, for the audit log, or null when they had no bed.
 */
export async function checkOutNow(tx: Tx, a: { employeeId: string; date: string; reason: string; note: string | null }) {
  const bed = await tx.bed.findUnique({ where: { employeeId: a.employeeId }, include: { room: { include: { camp: true } } } });
  if (bed) await tx.bed.update({ where: { id: bed.id }, data: { employeeId: null } });
  const when = stamp(a.date);
  const open = await tx.accommodationHistory.findFirst({ where: { employeeId: a.employeeId, checkOutDate: null }, orderBy: { checkInDate: "desc" } });
  if (open) {
    await tx.accommodationHistory.update({
      where: { id: open.id },
      data: { checkOutDate: when, checkOutReason: a.reason, checkOutNote: a.note, plannedCheckOutDate: null, plannedCheckOutReason: null, plannedCheckOutNote: null },
    });
  }
  const checkIn = await tx.campCheckIn.findFirst({ where: { employeeId: a.employeeId, status: { in: ["CHECKED_IN", "BED_ALLOCATED"] } }, orderBy: { createdAt: "desc" } });
  if (checkIn) await tx.campCheckIn.update({ where: { id: checkIn.id }, data: { status: "CHECKED_OUT", checkOutDate: when, checkOutReason: a.reason, bedId: null } });
  return bed ? { bedId: bed.id, campName: bed.room.camp.name, roomName: bed.room.name, bedLabel: bed.label } : null;
}

/**
 * Releases the beds whose scheduled checkout date has arrived. Called whenever a camp
 * screen loads or a bed is about to be handed out, so no nightly job is needed.
 */
export async function settleDueCheckouts(branchId: string | null, actor?: { id: string; name: string }): Promise<number> {
  const today = todayKey();
  const due = await prisma.accommodationHistory.findMany({
    where: {
      checkOutDate: null,
      plannedCheckOutDate: { not: null, lt: new Date(Date.parse(today + "T00:00:00Z") + 86_400_000) },
      ...(branchId ? { employee: { branchId } } : {}),
    },
    select: { id: true, employeeId: true, plannedCheckOutDate: true, plannedCheckOutReason: true, plannedCheckOutNote: true, employee: { select: { branchId: true } } },
  });
  let done = 0;
  for (const h of due) {
    try {
      const date = dayKey(h.plannedCheckOutDate!);
      const bed = await prisma.$transaction((tx) => checkOutNow(tx, { employeeId: h.employeeId, date, reason: h.plannedCheckOutReason ?? "Other", note: h.plannedCheckOutNote }));
      done++;
      if (actor && bed) {
        await logAudit({ entityType: "ACCOMMODATION", entityId: bed.bedId, action: "UPDATE", before: { employeeId: h.employeeId, ...bed }, after: { employeeId: null, scheduledCheckOut: date }, userId: actor.id, userName: `${actor.name} (scheduled checkout)`, branchId: h.employee.branchId });
      }
    } catch {
      /* one bad row shouldn't stop the others; it is picked up on the next load */
    }
  }
  return done;
}
