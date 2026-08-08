"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireUserWithBranch } from "@/lib/auth";
import { isOutsideBranch } from "@/lib/branch";
import { logAudit } from "@/lib/audit";
import type { DailyHourCell } from "@/lib/parseTimesheet";

function recompute(days: DailyHourCell[]) {
  let totalHours = 0;
  let absentCount = 0;
  for (const d of days) {
    const n = Number(d.value);
    if (d.value && Number.isFinite(n)) totalHours += n;
    else if (d.value.trim().toUpperCase() === "A") absentCount++;
  }
  return { totalHours, absentCount };
}

export async function updateDailyHoursAction(formData: FormData) {
  const { user, branchId, isSuperAdmin } = await requireUserWithBranch();
  const entryId = String(formData.get("entryId") || "");
  const daysJson = String(formData.get("days") || "");
  if (!entryId || !daysJson) return;

  const before = await prisma.timesheetEntry.findUnique({ where: { id: entryId } });
  if (!before || isOutsideBranch(before.branchId, branchId, isSuperAdmin)) return;

  let days: DailyHourCell[];
  try {
    days = JSON.parse(daysJson);
  } catch {
    return;
  }

  const { totalHours, absentCount } = recompute(days);
  const dailyHours = JSON.stringify(days);

  await prisma.timesheetEntry.update({
    where: { id: entryId },
    data: { dailyHours, totalHours, absentCount },
  });

  await logAudit({
    entityType: "TIMESHEET_ENTRY",
    entityId: entryId,
    action: "UPDATE",
    before: { totalHours: before.totalHours, absentCount: before.absentCount },
    after: { totalHours, absentCount },
    userId: user.id,
    userName: user.name,
    branchId,
  });

  revalidatePath("/invoices/client-timesheet");
}

// Applies one value (numeric hours, "A", or "OFF") to every day within
// [fromDate, toDate] across all selected entries — mirrors the competitor's
// "Edit Common Details" batch modal, minus the Official/Raw/Missing radio
// (deferred, see Phase 9 plan).
export async function batchUpdateHoursAction(formData: FormData) {
  const { user, branchId, isSuperAdmin } = await requireUserWithBranch();
  const entryIds = formData.getAll("entryId").map(String).filter(Boolean);
  const fromDate = String(formData.get("fromDate") || "");
  const toDate = String(formData.get("toDate") || "");
  const value = String(formData.get("value") || "").trim();
  if (entryIds.length === 0 || !fromDate || !toDate || !value) return { updated: 0 };

  let updated = 0;
  for (const entryId of entryIds) {
    const entry = await prisma.timesheetEntry.findUnique({ where: { id: entryId } });
    if (!entry || isOutsideBranch(entry.branchId, branchId, isSuperAdmin)) continue;

    let days: DailyHourCell[];
    try {
      days = JSON.parse(entry.dailyHours);
    } catch {
      continue;
    }

    const patched = days.map((d) =>
      d.date && d.date >= fromDate && d.date <= toDate ? { ...d, value } : d
    );
    const { totalHours, absentCount } = recompute(patched);

    await prisma.timesheetEntry.update({
      where: { id: entryId },
      data: { dailyHours: JSON.stringify(patched), totalHours, absentCount },
    });

    await logAudit({
      entityType: "TIMESHEET_ENTRY",
      entityId: entryId,
      action: "UPDATE",
      before: { totalHours: entry.totalHours, absentCount: entry.absentCount },
      after: { totalHours, absentCount },
      userId: user.id,
      userName: user.name,
      branchId,
    });

    updated++;
  }

  revalidatePath("/invoices/client-timesheet");
  return { updated, requested: entryIds.length };
}
