import { computeImportWarnings, parseConsolidatedWorkbook, type TimesheetOverrides } from "@/lib/parseTimesheet";
import { applyFixes, collectFixables } from "../fixes";
import { importParsedMonths } from "@/lib/importTimesheet";
import { nameKey } from "@/lib/partyCode";
import type { ApplyCtx, ApplyResult, Fix, ImportNote, RowReport } from "../types";

/** Import a consolidated timesheet workbook: suppliers, sponsors, clients,
 * workers, the monthly timesheet rows, and the days as attendance. */
export async function applyTimesheets(
  ctx: ApplyCtx,
  file: { buffer: Buffer; filename: string },
  overrides: TimesheetOverrides = {},
  aliases: Record<string, string> = {},
  fixes: Fix[] = [],
): Promise<ApplyResult> {
  const parsed = await parseConsolidatedWorkbook(file.buffer, overrides);
  // Corrections typed in on the review screen replace what the sheet has, then the warnings are worked out again so a fixed problem stops being reported.
  applyFixes(parsed.months, fixes);
  const warn = computeImportWarnings(parsed.months);
  // Names the person said are an existing company or client: use the existing spelling, so no duplicate is made.
  const alias = new Map(Object.entries(aliases).map(([from, to]) => [nameKey(from), to]));
  if (alias.size > 0) {
    for (const m of parsed.months) {
      for (const e of m.entries) {
        e.supplierName = alias.get(nameKey(e.supplierName)) ?? e.supplierName;
        if (e.sponsorName) e.sponsorName = alias.get(nameKey(e.sponsorName)) ?? e.sponsorName;
        if (e.clientName) e.clientName = alias.get(nameKey(e.clientName)) ?? e.clientName;
      }
    }
  }
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
  if (warn.zeroRateCount > 0) {
    notes.push({
      tone: "warn",
      title: `${warn.zeroRateCount} rows have a rate of 0`,
      detail: `Usually a column heading that wasn't recognised. e.g. ${warn.zeroRateSample.slice(0, 3).map((w) => `${w.employeeName} (${w.employeeIdNo})`).join(", ")}`,
    });
  }
  if (warn.implausibleHoursCount > 0) {
    notes.push({
      tone: "warn",
      title: `${warn.implausibleHoursCount} days have an unusual hours value`,
      detail: `Negative or over 24 hours. e.g. ${warn.implausibleHoursSample.slice(0, 3).map((w) => `${w.employeeName}: ${w.detail}`).join("; ")}`,
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
  if ((stats.projectsNotFound ?? []).length > 0) {
    notes.push({
      tone: "warn",
      title: "Some projects in the sheet don't exist",
      detail: `${(stats.projectsNotFound ?? []).join(", ")} — those rows weren't linked to a project. Create the project first, or match its code or name exactly, then re-upload.`,
    });
  }
  if ((stats.workersLinkedToProject ?? 0) > 0) {
    notes.push({ tone: "info", title: `${stats.workersLinkedToProject} workers linked to their project`, detail: "From the Project column. A worker already on a project keeps it." });
  }
  if ((stats.payRatesSet ?? 0) > 0) {
    notes.push({ tone: "info", title: `${stats.payRatesSet} workers given an hourly pay rate`, detail: "From the Pay Rate column, for payroll. A rate already on file is never replaced." });
  }
  const months = parsed.months.map((m) => m.month);
  const drafts = await ctx.db.payrollRun.findMany({ where: { branchId: ctx.branchId, month: { in: months }, status: "DRAFT" }, select: { month: true } });
  if (drafts.length > 0) {
    notes.push({
      tone: "info",
      title: `Payroll drafts for ${[...new Set(drafts.map((d) => d.month))].join(", ")} need recalculating`,
      detail: "A draft run keeps the figures it had when it was built. Open it on the Payroll page and press Recalculate to pick up this timesheet and its attendance.",
    });
  }
  if (stats.rowsSkipped > stats.skippedRowDetails.length) {
    notes.push({ tone: "info", title: `${stats.rowsSkipped - stats.skippedRowDetails.length} rows left unchanged`, detail: "Timesheets that are already locked (invoiced) are never overwritten." });
  }

  return {
    rows,
    notes,
    fixables: collectFixables(parsed.months),
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
