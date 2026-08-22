"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireUserWithBranch } from "@/lib/auth";
import { branchWhere, isOutsideBranch } from "@/lib/branch";
import { logAudit } from "@/lib/audit";
import { markActiveFromAttendance } from "@/lib/employeeStage";

export async function loadDayAttendanceAction(formData: FormData): Promise<{
  rows: Record<
    string,
    { id: string; status: string; normalHours: number | null; otHours: number | null; locked: boolean }
  >;
}> {
  const { branchId } = await requireUserWithBranch();
  const date = String(formData.get("date") || "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return { rows: {} };

  // Every mark for the day across the branch — the day screen lists the whole
  // roster, not one project's slice.
  const dateValue = new Date(date + "T00:00:00.000Z");
  const existing = await prisma.attendance.findMany({
    where: { date: dateValue, ...branchWhere(branchId) },
  });

  const rows: Record<
    string,
    { id: string; status: string; normalHours: number | null; otHours: number | null; locked: boolean }
  > = {};
  for (const a of existing) {
    rows[a.employeeId] = {
      id: a.id,
      status: a.status,
      normalHours: a.normalHours,
      otHours: a.otHours,
      locked: a.locked,
    };
  }
  return { rows };
}

type AttendanceRow = {
  employeeId: string;
  status: string;
  normalHours: string;
  otHours: string;
};

const VALID_STATUSES = new Set(["PRESENT", "ABSENT", "LEAVE", "HOLIDAY", "OFF"]);

function numberOrNull(value: string) {
  const s = value.trim();
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

// Create/update one day's attendance for a Supplier+Project roster. A row
// whose Attendance is already locked (approved) is skipped rather than
// silently overwritten — corrections to a locked day must go through
// requestAttendanceCorrectionAction instead.
export async function markAttendanceAction(
  formData: FormData
): Promise<{ saved: number; requested: number; error?: string }> {
  const { user, branchId, isSuperAdmin } = await requireUserWithBranch();
  if (!branchId) {
    return {
      saved: 0,
      requested: 0,
      error: isSuperAdmin
        ? "Pick a branch from the switcher before marking attendance."
        : "Your account has no branch assigned — contact an admin.",
    };
  }

  const date = String(formData.get("date") || "").trim();
  const projectId = String(formData.get("projectId") || "").trim() || null;
  const supplierId = String(formData.get("supplierId") || "").trim() || null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return { saved: 0, requested: 0, error: "Pick a valid date." };
  }

  let rows: AttendanceRow[];
  try {
    rows = JSON.parse(String(formData.get("rowsJson") || "[]"));
  } catch {
    return { saved: 0, requested: 0, error: "Could not read the entered rows." };
  }
  if (!Array.isArray(rows) || rows.length === 0) {
    return {
      saved: 0,
      requested: 0,
      error: "Tick the employees to record before saving — nothing was marked.",
    };
  }

  const dateValue = new Date(date + "T00:00:00.000Z");
  let saved = 0;
  const markedEmployeeIds: string[] = [];

  for (const row of rows) {
    const status = VALID_STATUSES.has(row.status) ? row.status : "PRESENT";
    const employee = await prisma.employee.findUnique({ where: { id: row.employeeId } });
    if (!employee || isOutsideBranch(employee.branchId, branchId, isSuperAdmin)) continue;

    const existing = await prisma.attendance.findUnique({
      where: { employeeId_date: { employeeId: employee.id, date: dateValue } },
    });
    if (existing?.locked && !isSuperAdmin) continue;

    const data = {
      status,
      normalHours: numberOrNull(row.normalHours),
      otHours: numberOrNull(row.otHours),
      markedById: user.id,
      // Taken from the worker, not from the form: a day is marked across the
      // whole roster now, so one project/supplier can't stand for every row.
      // The batch values remain as a fallback for callers that still send them.
      projectId: employee.projectId ?? projectId,
      supplierId: employee.supplierId ?? supplierId,
      branchId,
    };

    markedEmployeeIds.push(employee.id);

    if (existing) {
      await prisma.attendance.update({ where: { id: existing.id }, data });
      await logAudit({
        entityType: "ATTENDANCE",
        entityId: existing.id,
        action: "UPDATE",
        before: { status: existing.status, normalHours: existing.normalHours, otHours: existing.otHours },
        after: { status: data.status, normalHours: data.normalHours, otHours: data.otHours },
        userId: user.id,
        userName: user.name,
        branchId,
      });
    } else {
      const created = await prisma.attendance.create({
        data: { ...data, date: dateValue, employeeId: employee.id },
      });
      await logAudit({
        entityType: "ATTENDANCE",
        entityId: created.id,
        action: "CREATE",
        after: { employeeId: employee.id, date, status: data.status },
        userId: user.id,
        userName: user.name,
        branchId,
      });
    }
    saved++;
  }

  // A worker counts as working from the first day marked, not from the day the
  // paperwork said they would start.
  await markActiveFromAttendance(markedEmployeeIds);

  revalidatePath("/attendance");
  return { saved, requested: rows.length };
}

// Locks every Attendance row for a given date+project so normal users can no
// longer edit them directly — matches the plain-string-status,
// inline-check convention used by the Timesheet workflow (Phase B), just
// expressed as a boolean here since Attendance only has two states
// (open/locked) rather than a multi-stage pipeline.
export async function approveAttendanceDayAction(formData: FormData) {
  const { user, branchId, isSuperAdmin } = await requireUserWithBranch();
  const date = String(formData.get("date") || "").trim();
  const projectId = String(formData.get("projectId") || "").trim() || null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return { updated: 0 };

  const dateValue = new Date(date + "T00:00:00.000Z");
  const where = {
    date: dateValue,
    projectId,
    locked: false,
    ...(isSuperAdmin ? {} : { branchId: branchId ?? undefined }),
  };

  const rows = await prisma.attendance.findMany({ where });
  const result = await prisma.attendance.updateMany({
    where: { id: { in: rows.map((r) => r.id) } },
    data: { locked: true, approvedById: user.id, approvedAt: new Date() },
  });

  for (const row of rows) {
    await logAudit({
      entityType: "ATTENDANCE",
      entityId: row.id,
      action: "UPDATE",
      before: { locked: false },
      after: { locked: true, approvedById: user.id },
      userId: user.id,
      userName: user.name,
      branchId,
    });
  }

  revalidatePath("/attendance");
  return { updated: result.count };
}

export async function requestAttendanceCorrectionAction(formData: FormData) {
  const { user, branchId, isSuperAdmin } = await requireUserWithBranch();
  const attendanceId = String(formData.get("attendanceId") || "");
  const reason = String(formData.get("reason") || "").trim();
  if (!attendanceId || !reason) return;

  const attendance = await prisma.attendance.findUnique({ where: { id: attendanceId } });
  if (!attendance || isOutsideBranch(attendance.branchId, branchId, isSuperAdmin)) return;

  const requestedStatus = String(formData.get("requestedStatus") || "").trim() || null;
  const requestedNormalHours = numberOrNull(String(formData.get("requestedNormalHours") || ""));
  const requestedOtHours = numberOrNull(String(formData.get("requestedOtHours") || ""));

  const created = await prisma.attendanceCorrectionRequest.create({
    data: {
      attendanceId,
      requestedStatus: requestedStatus && VALID_STATUSES.has(requestedStatus) ? requestedStatus : null,
      requestedNormalHours,
      requestedOtHours,
      reason,
      requestedById: user.id,
    },
  });

  await logAudit({
    entityType: "ATTENDANCE_CORRECTION",
    entityId: created.id,
    action: "CREATE",
    after: { attendanceId, requestedStatus, requestedNormalHours, requestedOtHours, reason },
    userId: user.id,
    userName: user.name,
    branchId,
  });

  revalidatePath("/attendance");
}

export async function reviewCorrectionRequestAction(formData: FormData) {
  const { user, branchId, isSuperAdmin } = await requireUserWithBranch();
  const correctionId = String(formData.get("correctionId") || "");
  const decision = String(formData.get("decision") || "");
  if (!correctionId || (decision !== "APPROVED" && decision !== "REJECTED")) return;

  const correction = await prisma.attendanceCorrectionRequest.findUnique({
    where: { id: correctionId },
    include: { attendance: true },
  });
  if (!correction || correction.status !== "PENDING") return;
  if (isOutsideBranch(correction.attendance.branchId, branchId, isSuperAdmin)) return;

  await prisma.attendanceCorrectionRequest.update({
    where: { id: correctionId },
    data: { status: decision, reviewedById: user.id, reviewedAt: new Date() },
  });

  if (decision === "APPROVED") {
    await prisma.attendance.update({
      where: { id: correction.attendanceId },
      data: {
        status: correction.requestedStatus ?? correction.attendance.status,
        normalHours: correction.requestedNormalHours ?? correction.attendance.normalHours,
        otHours: correction.requestedOtHours ?? correction.attendance.otHours,
        locked: true,
      },
    });
  }

  await logAudit({
    entityType: "ATTENDANCE_CORRECTION",
    entityId: correctionId,
    action: "UPDATE",
    before: { status: "PENDING" },
    after: { status: decision },
    userId: user.id,
    userName: user.name,
    branchId,
  });

  revalidatePath("/attendance");
}

/**
 * Removes an attendance mark entirely, for the case where a day was recorded
 * against the wrong employee — setting a status can't express "this shouldn't
 * exist". Locked days stay put unless a super admin does it, matching the
 * edit rule in markAttendanceAction.
 */
export async function deleteAttendanceAction(
  formData: FormData
): Promise<{ deleted: number; error?: string }> {
  const { user, branchId, isSuperAdmin } = await requireUserWithBranch();
  const id = String(formData.get("attendanceId") || "").trim();
  if (!id) return { deleted: 0 };

  const existing = await prisma.attendance.findUnique({
    where: { id },
    include: { employee: { select: { name: true } } },
  });
  if (!existing || isOutsideBranch(existing.branchId, branchId, isSuperAdmin)) {
    return { deleted: 0 };
  }
  if (existing.locked && !isSuperAdmin) {
    return { deleted: 0, error: "That day is approved and locked — ask an admin." };
  }

  // Correction requests against this mark cascade from the schema.
  await prisma.attendance.delete({ where: { id } });

  await logAudit({
    entityType: "ATTENDANCE",
    entityId: id,
    action: "DELETE",
    before: {
      employeeId: existing.employeeId,
      employeeName: existing.employee.name,
      date: existing.date,
      status: existing.status,
      normalHours: existing.normalHours,
      otHours: existing.otHours,
    },
    userId: user.id,
    userName: user.name,
    branchId,
  });

  revalidatePath("/attendance");
  return { deleted: 1 };
}
