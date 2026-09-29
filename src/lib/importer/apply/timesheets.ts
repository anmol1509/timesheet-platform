import { parseConsolidatedWorkbook, type TimesheetOverrides } from "@/lib/parseTimesheet";
import { importParsedMonths } from "@/lib/importTimesheet";
import type { ApplyCtx, ApplyResult, ImportNote, RowReport } from "../types";

/** Import a consolidated timesheet workbook: suppliers, sponsors, clients,
 * workers, the monthly timesheet rows, and the days as attendance. */
export async function applyTimesheets(
  ctx: ApplyCtx,
  file: { buffer: Buffer; filename: string },
  overrides: TimesheetOverrides = {},
): Promise<ApplyResult> {
  const parsed = await parseConsolidatedWorkbook(file.buffer, overrides);
  if (parsed.months.length === 0) {
    return {
      rows: [],
      counts: { created: 0, updated: 0, failed: 0 },
      notes: [{ tone: "warn", title: "No timesheet months found", detail: "Expected sheets named like \"Aug 26\" or \"MAY-25\", with an \"EMPLOYEE NAME\" column." }],
    };
  }

  const upload = await ctx.db.upload.create({
    data: { filename: file.filename, fileData: new Uint8Array(file.buffer), uploadedById: ctx.user.id, branchId: ctx.branchId },
  });
  const stats = await importParsedMonths(parsed.months, upload.id, ctx.branchId, null, {
    db: ctx.db,
    userId: ctx.user.id,
    progress: ctx.progress,
  });

  const rows: RowReport[] = stats.skippedRowDetails.map((r) => ({
    row: r.row,
    name: `${r.name} (${r.idNo})`,
    status: "error" as const,
    message: `${r.sheetName}: ${r.reason}`,
  }));

  const notes: ImportNote[] = [];
  for (const s of parsed.unrecognizedSheets) {
    notes.push({ tone: "info", title: `Sheet "${s}" was skipped`, detail: "Its name isn't a month (like \"Aug 26\") or it has no EMPLOYEE NAME column." });
  }
  if (parsed.zeroRateCount > 0) {
    notes.push({
      tone: "warn",
      title: `${parsed.zeroRateCount} rows have a rate of 0`,
      detail: `Usually a column heading that wasn't recognised. e.g. ${parsed.zeroRateSample.slice(0, 3).map((w) => `${w.employeeName} (${w.employeeIdNo})`).join(", ")}`,
    });
  }
  if (parsed.implausibleHoursCount > 0) {
    notes.push({
      tone: "warn",
      title: `${parsed.implausibleHoursCount} days have an unusual hours value`,
      detail: `Negative or over 24 hours. e.g. ${parsed.implausibleHoursSample.slice(0, 3).map((w) => `${w.employeeName}: ${w.detail}`).join("; ")}`,
    });
  }
  if ((stats.attendanceConflicts ?? 0) + (stats.attendanceLocked ?? 0) > 0) {
    notes.push({
      tone: "warn",
      title: `${(stats.attendanceConflicts ?? 0) + (stats.attendanceLocked ?? 0)} days already had attendance that differs`,
      detail: "They were left as they were. The sheet is never allowed to overwrite what a supervisor marked.",
    });
  }
  if ((stats.attendanceUnrecognised ?? 0) > 0) {
    notes.push({
      tone: "warn",
      title: `${stats.attendanceUnrecognised} cells weren't recognised as attendance`,
      detail: `Skipped: ${(stats.unrecognisedValues ?? []).join(", ")}. Recognised: hours, A, L / SL / SICK, H, OFF.`,
    });
  }
  if ((stats.nationalityNotSaved ?? 0) > 0) {
    notes.push({
      tone: "warn",
      title: `${stats.nationalityNotSaved} workers have a Nationality that isn't a country`,
      detail: `${(stats.nationalityNotSavedValues ?? []).join(", ")} — not saved. Use the country, e.g. India.`,
    });
  }
  if (stats.rowsSkipped > stats.skippedRowDetails.length) {
    notes.push({ tone: "info", title: `${stats.rowsSkipped - stats.skippedRowDetails.length} rows left unchanged`, detail: "Timesheets that are already locked (invoiced) are never overwritten." });
  }

  return {
    rows,
    notes,
    counts: {
      created: stats.entriesCreated,
      updated: stats.entriesUpdated,
      failed: stats.skippedRowDetails.length,
      suppliersCreated: stats.suppliersCreated,
      clientsCreated: stats.clientsCreated,
      subsidiariesLinked: stats.subsidiariesLinked ?? 0,
      attendanceCreated: stats.attendanceCreated ?? 0,
      months: stats.monthsProcessed.length,
    },
  };
}
