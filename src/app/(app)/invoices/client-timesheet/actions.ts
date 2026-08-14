"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireUserWithBranch } from "@/lib/auth";
import { isOutsideBranch } from "@/lib/branch";
import { logAudit } from "@/lib/audit";
import { importParsedMonths } from "@/lib/importTimesheet";
import type { DailyHourCell, ParsedEntry, ParsedMonth } from "@/lib/parseTimesheet";

const WEEKDAY_ABBR = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

type ManualRow = {
  employeeIdNo: string;
  employeeName: string;
  trade: string;
  rate: string;
  supplierName: string;
  clientName: string;
  days: string[];
};

function monthLabelFromKey(month: string) {
  const [y, m] = month.split("-");
  const date = new Date(Number(y), Number(m) - 1, 1);
  return date
    .toLocaleDateString("en-US", { month: "short", year: "2-digit" })
    .replace(" ", "-")
    .toUpperCase();
}

export async function submitManualEntryAction(
  _prevState: { error: string | null },
  formData: FormData
): Promise<{ error: string | null }> {
  const { user, branchId, isSuperAdmin } = await requireUserWithBranch();
  if (!branchId) {
    return {
      error: isSuperAdmin
        ? "Pick a branch from the switcher before adding a manual entry."
        : "Your account has no branch assigned — contact an admin.",
    };
  }

  const month = String(formData.get("month") || "").trim();
  if (!/^\d{4}-\d{2}$/.test(month)) {
    return { error: "Pick a valid month." };
  }
  const projectId = String(formData.get("projectId") || "").trim() || null;
  const siteIdInput = String(formData.get("siteId") || "").trim() || null;
  // Project is the primary location concept — the legacy free-text `site`
  // column mirrors the picked project's name for display consistency with
  // older Excel-sourced rows that still carry independent site text, unless
  // a specific Site under that project was also picked, which takes
  // priority.
  const project = projectId ? await prisma.project.findUnique({ where: { id: projectId }, select: { name: true } }) : null;
  const pickedSite =
    siteIdInput && projectId
      ? await prisma.site.findFirst({ where: { id: siteIdInput, projectId } })
      : null;
  const site = pickedSite?.name ?? project?.name ?? null;
  const siteId = pickedSite?.id ?? null;

  let rows: ManualRow[];
  try {
    rows = JSON.parse(String(formData.get("rowsJson") || "[]"));
  } catch {
    return { error: "Could not read the entered rows." };
  }
  if (!Array.isArray(rows) || rows.length === 0) {
    return { error: "Add at least one employee row." };
  }

  const [year, monthNum] = month.split("-").map(Number);
  const daysInMonth = new Date(year, monthNum, 0).getDate();

  const entries: ParsedEntry[] = [];
  for (const [i, row] of rows.entries()) {
    const employeeIdNo = (row.employeeIdNo || "").trim();
    const employeeName = (row.employeeName || "").trim();
    const supplierName = (row.supplierName || "").trim();
    const trade = (row.trade || "").trim();
    const rate = Number(row.rate);

    if (!employeeIdNo || !employeeName || !supplierName || !trade) {
      return {
        error: `Row ${i + 1}: ID, name, trade, and supplier are all required.`,
      };
    }
    if (!Number.isFinite(rate) || rate < 0) {
      return { error: `Row ${i + 1}: rate must be a valid number.` };
    }

    const dailyHours: DailyHourCell[] = [];
    let totalHours = 0;
    let absentCount = 0;
    for (let d = 1; d <= daysInMonth; d++) {
      const raw = (row.days?.[d - 1] || "").trim();
      const num = raw === "" ? null : Number(raw);
      const date = new Date(Date.UTC(year, monthNum - 1, d));
      const label = WEEKDAY_ABBR[date.getUTCDay()];
      if (raw !== "" && num != null && Number.isFinite(num)) {
        totalHours += num;
      } else if (/^a$/i.test(raw)) {
        absentCount++;
      }
      dailyHours.push({
        date: date.toISOString().slice(0, 10),
        label,
        value: num != null && Number.isFinite(num) ? String(num) : raw,
      });
    }

    entries.push({
      employeeIdNo,
      employeeName,
      supplierName,
      clientName: (row.clientName || "").trim() || null,
      site,
      siteId,
      trade,
      rate,
      dailyHours,
      totalHours,
      absentCount,
      invoiceValue: rate * totalHours,
    });
  }

  const monthLabel = monthLabelFromKey(month);
  const parsedMonth: ParsedMonth = {
    sheetName: "Manual Entry",
    month,
    monthLabel,
    entries,
    skippedRows: 0,
    skippedRowDetails: [],
  };

  const uploadData = {
    filename: `Manual Entry — ${monthLabel}`,
    fileData: null,
    uploadedById: user.id,
    branchId,
  };
  const upload = await prisma.upload.create({ data: uploadData });

  await logAudit({
    entityType: "UPLOAD",
    entityId: upload.id,
    action: "CREATE",
    after: { filename: uploadData.filename, uploadedById: user.id },
    userId: user.id,
    userName: user.name,
    branchId,
  });

  await importParsedMonths([parsedMonth], upload.id, branchId, projectId);

  revalidatePath("/upload");
  revalidatePath("/history");
  revalidatePath("/employees");
  revalidatePath("/invoices/client-timesheet");
  redirect(`/invoices/client-timesheet?month=${month}`);
}

type DailyRow = { employeeId: string; rate: string; value: string };

// Logs one day's hours per employee for a Supplier+Project, without
// touching any other day already recorded that month. Deliberately does
// NOT reuse importParsedMonths — that pipeline replaces `dailyHours`
// wholesale on update, which would silently wipe out other days.
export async function submitDailyTimesheetAction(
  formData: FormData
): Promise<{ saved: number; requested: number; error?: string }> {
  const { user, branchId, isSuperAdmin } = await requireUserWithBranch();
  if (!branchId) {
    return {
      saved: 0,
      requested: 0,
      error: isSuperAdmin
        ? "Pick a branch from the switcher before adding a daily entry."
        : "Your account has no branch assigned — contact an admin.",
    };
  }
  const date = String(formData.get("date") || "").trim();
  const supplierId = String(formData.get("supplierId") || "").trim();
  const projectId = String(formData.get("projectId") || "").trim();
  const siteId = String(formData.get("siteId") || "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !supplierId || !projectId) {
    return { saved: 0, requested: 0, error: "Pick a supplier, a project, and a date." };
  }

  // Site is optional — only set when the chosen project actually has one
  // picked; a project with no sites defined behaves exactly as before.
  const site = siteId
    ? await prisma.site.findFirst({ where: { id: siteId, projectId } })
    : null;

  let rows: DailyRow[];
  try {
    rows = JSON.parse(String(formData.get("rowsJson") || "[]"));
  } catch {
    return { saved: 0, requested: 0, error: "Could not read the entered rows." };
  }
  rows = rows.filter((r) => r.value && r.value.trim());
  if (rows.length === 0) {
    return { saved: 0, requested: 0, error: "Enter hours for at least one employee." };
  }

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { name: true, clientId: true, branchId: true },
  });
  if (!project || isOutsideBranch(project.branchId, branchId, isSuperAdmin)) {
    return { saved: 0, requested: rows.length, error: "Project not found." };
  }

  const month = date.slice(0, 7);
  const monthLabel = monthLabelFromKey(month);
  const [year, monthNum] = month.split("-").map(Number);
  const daysInMonth = new Date(year, monthNum, 0).getDate();

  let saved = 0;
  for (const row of rows) {
    const employee = await prisma.employee.findUnique({ where: { id: row.employeeId } });
    if (!employee || isOutsideBranch(employee.branchId, branchId, isSuperAdmin) || !employee.trade) continue;
    const rate = Number(row.rate);
    if (!Number.isFinite(rate) || rate < 0) continue;
    const trade = employee.trade;

    const existing = await prisma.timesheetEntry.findUnique({
      where: {
        month_supplierId_employeeIdNo_trade: { month, supplierId, employeeIdNo: employee.employeeIdNo, trade },
      },
    });

    if (existing) {
      if (existing.status === "LOCKED" && !isSuperAdmin) continue;
      let days: DailyHourCell[];
      try {
        days = JSON.parse(existing.dailyHours);
      } catch {
        days = [];
      }
      const patched = days.map((d) => (d.date === date ? { ...d, value: row.value } : d));
      const { totalHours, absentCount } = recompute(patched);

      await prisma.timesheetEntry.update({
        where: { id: existing.id },
        data: {
          dailyHours: JSON.stringify(patched),
          totalHours,
          absentCount,
          clientId: existing.clientId ?? project.clientId,
          projectId: existing.projectId ?? projectId,
          site: site?.name ?? existing.site ?? project.name,
          siteId: site ? site.id : existing.siteId,
        },
      });

      await logAudit({
        entityType: "TIMESHEET_ENTRY",
        entityId: existing.id,
        action: "UPDATE",
        before: { totalHours: existing.totalHours, absentCount: existing.absentCount },
        after: { totalHours, absentCount },
        userId: user.id,
        userName: user.name,
        branchId,
      });
    } else {
      const dailyHours: DailyHourCell[] = [];
      for (let d = 1; d <= daysInMonth; d++) {
        const cellDate = new Date(Date.UTC(year, monthNum - 1, d));
        const iso = cellDate.toISOString().slice(0, 10);
        dailyHours.push({
          date: iso,
          label: WEEKDAY_ABBR[cellDate.getUTCDay()],
          value: iso === date ? row.value : "",
        });
      }
      const { totalHours, absentCount } = recompute(dailyHours);

      const created = await prisma.timesheetEntry.create({
        data: {
          month,
          monthLabel,
          employeeIdNo: employee.employeeIdNo,
          employeeName: employee.name,
          trade,
          rate,
          dailyHours: JSON.stringify(dailyHours),
          totalHours,
          absentCount,
          invoiceValue: rate * totalHours,
          branchId,
          supplierId,
          clientId: project.clientId,
          projectId,
          site: site?.name ?? project.name,
          siteId: site?.id ?? null,
        },
      });

      await logAudit({
        entityType: "TIMESHEET_ENTRY",
        entityId: created.id,
        action: "CREATE",
        after: { month, employeeIdNo: employee.employeeIdNo, trade, date, value: row.value },
        userId: user.id,
        userName: user.name,
        branchId,
      });
    }

    saved++;
  }

  revalidatePath("/invoices/client-timesheet");
  return { saved, requested: rows.length };
}

// Legal forward transitions for the timesheet status workflow. No
// state-machine helper exists elsewhere in this codebase (statuses are
// plain strings + inline checks throughout) — a small const map here keeps
// the transition table readable without introducing a new pattern.
const TIMESHEET_TRANSITIONS: Record<string, string[]> = {
  DRAFT: ["SUBMITTED"],
  SUBMITTED: ["UNDER_REVIEW", "CLIENT_APPROVED", "REJECTED"],
  UNDER_REVIEW: ["CLIENT_APPROVED", "REJECTED"],
  CLIENT_APPROVED: ["LOCKED"],
  REJECTED: ["DRAFT", "SUBMITTED"],
  LOCKED: [],
};

async function transitionTimesheetEntries(
  entryIds: string[],
  toStatus: string,
  branchId: string | null,
  isSuperAdmin: boolean,
  userId: string,
  userName: string
) {
  let updated = 0;
  for (const entryId of entryIds) {
    const entry = await prisma.timesheetEntry.findUnique({ where: { id: entryId } });
    if (!entry || isOutsideBranch(entry.branchId, branchId, isSuperAdmin)) continue;
    if (!TIMESHEET_TRANSITIONS[entry.status]?.includes(toStatus)) continue;

    await prisma.timesheetEntry.update({ where: { id: entryId }, data: { status: toStatus } });

    await logAudit({
      entityType: "TIMESHEET_ENTRY",
      entityId: entryId,
      action: "UPDATE",
      before: { status: entry.status },
      after: { status: toStatus },
      userId,
      userName,
      branchId,
    });
    updated++;
  }
  return updated;
}

export async function submitTimesheetForReviewAction(formData: FormData) {
  const { user, branchId, isSuperAdmin } = await requireUserWithBranch();
  const entryIds = formData.getAll("entryId").map(String).filter(Boolean);
  const updated = await transitionTimesheetEntries(
    entryIds,
    "SUBMITTED",
    branchId,
    isSuperAdmin,
    user.id,
    user.name
  );
  revalidatePath("/invoices/client-timesheet");
  return { updated, requested: entryIds.length };
}

export async function approveTimesheetAction(formData: FormData) {
  const { user, branchId, isSuperAdmin } = await requireUserWithBranch();
  const entryIds = formData.getAll("entryId").map(String).filter(Boolean);
  const updated = await transitionTimesheetEntries(
    entryIds,
    "CLIENT_APPROVED",
    branchId,
    isSuperAdmin,
    user.id,
    user.name
  );
  revalidatePath("/invoices/client-timesheet");
  return { updated, requested: entryIds.length };
}

export async function rejectTimesheetAction(formData: FormData) {
  const { user, branchId, isSuperAdmin } = await requireUserWithBranch();
  const entryIds = formData.getAll("entryId").map(String).filter(Boolean);
  const updated = await transitionTimesheetEntries(
    entryIds,
    "REJECTED",
    branchId,
    isSuperAdmin,
    user.id,
    user.name
  );
  revalidatePath("/invoices/client-timesheet");
  return { updated, requested: entryIds.length };
}

export async function lockTimesheetAction(formData: FormData) {
  const { user, branchId, isSuperAdmin } = await requireUserWithBranch();
  const entryIds = formData.getAll("entryId").map(String).filter(Boolean);
  const updated = await transitionTimesheetEntries(
    entryIds,
    "LOCKED",
    branchId,
    isSuperAdmin,
    user.id,
    user.name
  );
  revalidatePath("/invoices/client-timesheet");
  return { updated, requested: entryIds.length };
}

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
  if (before.status === "LOCKED" && !isSuperAdmin) return;

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

type DateRange = { fromDate: string; toDate: string; value: string };

// Applies one or more (fromDate, toDate, value) ranges across all selected
// entries — mirrors the competitor's "Edit Common Details" batch modal,
// minus the Official/Raw/Missing radio (deferred, see Phase 9 plan). Ranges
// are applied in array order, so a later range wins on overlapping dates.
export async function batchUpdateHoursAction(formData: FormData) {
  const { user, branchId, isSuperAdmin } = await requireUserWithBranch();
  const entryIds = formData.getAll("entryId").map(String).filter(Boolean);
  let ranges: DateRange[];
  try {
    ranges = JSON.parse(String(formData.get("rangesJson") || "[]"));
  } catch {
    ranges = [];
  }
  ranges = ranges.filter((r) => r.fromDate && r.toDate && r.value);
  if (entryIds.length === 0 || ranges.length === 0) return { updated: 0, requested: entryIds.length };

  let updated = 0;
  for (const entryId of entryIds) {
    const entry = await prisma.timesheetEntry.findUnique({ where: { id: entryId } });
    if (!entry || isOutsideBranch(entry.branchId, branchId, isSuperAdmin)) continue;
    if (entry.status === "LOCKED" && !isSuperAdmin) continue;

    let days: DailyHourCell[];
    try {
      days = JSON.parse(entry.dailyHours);
    } catch {
      continue;
    }

    let patched = days;
    for (const range of ranges) {
      patched = patched.map((d) =>
        d.date && d.date >= range.fromDate && d.date <= range.toDate ? { ...d, value: range.value } : d
      );
    }
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

/**
 * Removes a timesheet row outright — for a line entered against the wrong
 * employee or a duplicate upload, where zeroing the hours would still leave a
 * phantom row on the client's sheet.
 *
 * A locked row has been through approval and may already sit on an invoice,
 * so it stays unless a super admin removes it, matching the edit rule in
 * updateDailyHoursAction.
 */
export async function deleteTimesheetEntryAction(
  formData: FormData
): Promise<{ deleted: number; error?: string }> {
  const { user, branchId, isSuperAdmin } = await requireUserWithBranch();
  const entryId = String(formData.get("entryId") || "");
  if (!entryId) return { deleted: 0 };

  const before = await prisma.timesheetEntry.findUnique({ where: { id: entryId } });
  if (!before || isOutsideBranch(before.branchId, branchId, isSuperAdmin)) {
    return { deleted: 0 };
  }
  if (before.status === "LOCKED" && !isSuperAdmin) {
    return { deleted: 0, error: "That row is locked — only an admin can remove it." };
  }

  await prisma.timesheetEntry.delete({ where: { id: entryId } });

  await logAudit({
    entityType: "TIMESHEET_ENTRY",
    entityId: entryId,
    action: "DELETE",
    before: {
      month: before.month,
      employeeIdNo: before.employeeIdNo,
      employeeName: before.employeeName,
      trade: before.trade,
      totalHours: before.totalHours,
      invoiceValue: before.invoiceValue,
      status: before.status,
    },
    userId: user.id,
    userName: user.name,
    branchId,
  });

  revalidatePath("/invoices/client-timesheet");
  return { deleted: 1 };
}
