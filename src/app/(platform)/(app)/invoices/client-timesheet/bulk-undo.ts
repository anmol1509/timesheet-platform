"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireUserWithBranch, requirePermission, requireWrite } from "@/lib/auth";
import { isOutsideBranch } from "@/lib/branch";
import { logAudit } from "@/lib/audit";
import { isTimesheetOpen } from "@/lib/timesheetCells";

type Snapshot = { id: string; status: string; dailyHours: string; totalHours: number; absentCount: number; absentDeduction: number; invoiceValue: number; rate: number };
type SavedChanges = { month: string; startedAt: string; workers: string[]; created: string[]; replaced: Snapshot[] };

export type UndoResult = { error?: string; removed?: number; restored?: number; skipped?: number; attendanceRemoved?: number };

/**
 * Puts a bulk timesheet save back as it was: rows it created are deleted, rows it overwrote get their earlier hours back, and the
 * attendance it added (by the same person, since that save, not yet approved or locked) is removed. A row that has since been
 * submitted, approved or locked is left alone and counted, because it has moved on from this save.
 */
export async function undoBulkSaveAction(saveId: string): Promise<UndoResult> {
  await requireWrite("timesheets.client-timesheet");
  await requirePermission("timesheets.client-timesheet", "delete");
  const { user, branchId, isSuperAdmin } = await requireUserWithBranch();

  const save = await prisma.auditLog.findUnique({ where: { id: saveId } });
  if (!save || save.entityType !== "BULK_TIMESHEET" || isOutsideBranch(save.branchId, branchId, isSuperAdmin)) return { error: "That save wasn't found." };
  if (save.revertedAt) return { error: "That save has already been undone." };
  const c = save.changes as unknown as SavedChanges | null;
  if (!c || !Array.isArray(c.created) || !Array.isArray(c.replaced)) return { error: "That save can't be undone: its details were not kept." };

  let removed = 0, restored = 0, skipped = 0;

  const created = await prisma.timesheetEntry.findMany({ where: { id: { in: c.created } }, select: { id: true, status: true } });
  for (const e of created) {
    if (!isTimesheetOpen(e.status)) { skipped++; continue; }
    await prisma.timesheetEntry.delete({ where: { id: e.id } });
    removed++;
  }
  for (const snap of c.replaced) {
    const now = await prisma.timesheetEntry.findUnique({ where: { id: snap.id }, select: { status: true } });
    if (!now) continue;
    if (!isTimesheetOpen(now.status)) { skipped++; continue; }
    await prisma.timesheetEntry.update({
      where: { id: snap.id },
      data: { dailyHours: snap.dailyHours, totalHours: snap.totalHours, absentCount: snap.absentCount, absentDeduction: snap.absentDeduction, invoiceValue: snap.invoiceValue, rate: snap.rate },
    });
    restored++;
  }

  // Attendance added by this save: that person, that month, created after the save began, and not approved or locked since.
  const [y, m] = c.month.split("-").map(Number);
  const employees = await prisma.employee.findMany({ where: { employeeIdNo: { in: c.workers }, ...(isSuperAdmin ? {} : { branchId: branchId ?? undefined }) }, select: { id: true } });
  const attendance = await prisma.attendance.deleteMany({
    where: {
      employeeId: { in: employees.map((e) => e.id) },
      date: { gte: new Date(Date.UTC(y, m - 1, 1)), lt: new Date(Date.UTC(y, m, 1)) },
      markedById: save.userId,
      createdAt: { gte: new Date(new Date(c.startedAt).getTime() - 5000) },
      locked: false,
      approvedById: null,
    },
  });

  await prisma.auditLog.update({ where: { id: save.id }, data: { revertedAt: new Date(), revertedByName: user.name } });
  await logAudit({
    entityType: "BULK_TIMESHEET",
    entityId: save.entityId,
    action: "DELETE",
    before: { month: c.month, removed, restored, skipped, attendanceRemoved: attendance.count },
    userId: user.id,
    userName: user.name,
    branchId,
    source: "REVERT",
    revertOfId: save.id,
  });

  revalidatePath("/invoices/client-timesheet");
  revalidatePath("/attendance");
  revalidatePath("/employees");
  return { removed, restored, skipped, attendanceRemoved: attendance.count };
}
