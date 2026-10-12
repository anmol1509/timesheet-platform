"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireUserWithBranch, subjectOf } from "@/lib/auth";
import { isOutsideBranch } from "@/lib/branch";
import { can } from "@/lib/permissions";
import { isAdminRole } from "@/lib/roles";
import { logAudit } from "@/lib/audit";
import { employmentWindow, monthBounds } from "@/lib/payroll";
import { rebuildRunLines } from "@/lib/payrollRun";
import { loadPayDays, type PayDaysView } from "@/lib/payDaysData";
import { attendanceFromCell } from "@/lib/payDays";
import { parseDailyHours, readCell, recompute, writeCell } from "@/lib/timesheetCells";
import { syncAttendanceDay } from "@/lib/attendanceTimesheetSync";
import { assertContactsValid } from "@/lib/validators";

type Result = { error: string | null; view?: PayDaysView };
const STATUSES = new Set(["PRESENT", "ABSENT", "LEAVE", "SICK_LEAVE", "IDLE", "HOLIDAY", "OFF"]);
const hours = (v: FormDataEntryValue | null) => {
  const s = String(v ?? "").trim();
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) && n >= 0 && n <= 24 ? n : NaN;
};

async function guard(runId: string, employeeId: string) {
  const { user, branchId, isSuperAdmin } = await requireUserWithBranch();
  const subject = subjectOf(user);
  if (!can(subject, "payroll.payroll", "view")) return { error: "You don't have permission to view payroll." } as const;
  const canEditAttendance = can(subject, "timesheets.attendance", "edit") && can(subject, "payroll.payroll", "edit");
  const canEditPayroll = can(subject, "payroll.payroll", "edit");
  const loaded = await loadPayDays(runId, employeeId, { canEditAttendance, canEditPayroll });
  if ("error" in loaded) return { error: loaded.error } as const;
  if (isOutsideBranch(loaded.branchId, branchId, isSuperAdmin)) return { error: "Payslip line not found." } as const;
  return { user, loaded, branchId: loaded.branchId } as const;
}

export async function loadPayDaysAction(runId: string, employeeId: string): Promise<Result> {
  const g = await guard(runId, employeeId);
  return "error" in g ? { error: g.error ?? "Not allowed." } : { error: null, view: g.loaded.view };
}

/** Writes one day of attendance for the person, keeps their client timesheet in step, and recalculates the run. */
async function applyDay(g: Exclude<Awaited<ReturnType<typeof guard>>, { error: string }>, date: string, next: { status: string; normalHours: number | null; otHours: number | null }, source: string): Promise<Result> {
  const { user, loaded } = g;
  const view = loaded.view;
  if (!view.editable) return { error: view.why ?? "This day can't be changed." };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || date.slice(0, 7) !== view.month) return { error: "That day isn't in this payroll month." };
  const row = view.rows.find((r) => r.date === date);
  if (!row || row.kind === "outside") return { error: "They were not employed on that day." };

  const run = await prisma.payrollRun.findUnique({ where: { id: view.runId } });
  const emp = await prisma.employee.findUnique({ where: { id: view.employee.id } });
  if (!run || !emp) return { error: "Run or employee not found." };
  if (!emp.siteArrivalDate) return { error: "Their site arrival isn't confirmed yet, so attendance can't be recorded." };
  const dateValue = new Date(`${date}T00:00:00.000Z`);
  if (dateValue < emp.siteArrivalDate) return { error: `That is before their site arrival on ${emp.siteArrivalDate.toISOString().slice(0, 10)}.` };
  const bounds = monthBounds(run.month)!;
  if (!employmentWindow(bounds, emp.joinDate, emp.exitDate)) return { error: "They were not employed this month." };

  const existing = await prisma.attendance.findUnique({ where: { employeeId_date: { employeeId: emp.id, date: dateValue } } });
  if (existing?.locked && !isAdminRole(user.role)) return { error: "That day is approved and locked. Ask an admin." };
  const data = { status: next.status, normalHours: next.normalHours, otHours: next.otHours, markedById: user.id, projectId: emp.projectId, supplierId: emp.supplierId, branchId: run.branchId };
  if (existing) await prisma.attendance.update({ where: { id: existing.id }, data });
  else await prisma.attendance.create({ data: { ...data, date: dateValue, employeeId: emp.id } });
  await logAudit({ entityType: "ATTENDANCE", entityId: existing?.id ?? `${emp.id}:${date}`, action: existing ? "UPDATE" : "CREATE", before: existing ? { status: existing.status, normalHours: existing.normalHours, otHours: existing.otHours } : null, after: { date, ...next, source }, userId: user.id, userName: user.name, branchId: run.branchId });

  await syncAttendanceDay(date, [emp.id], { branchId: run.branchId, userId: user.id, userName: user.name, isSuperAdmin: false });
  await rebuildRunLines(run);
  await prisma.payrollRunEvent.create({ data: { runId: run.id, action: "RECALCULATED", note: `${emp.name}: ${date} changed to ${next.status}${source === "timesheet" ? " (copied from the timesheet)" : ""}`, userId: user.id, userName: user.name } });
  revalidatePath(`/payroll/${run.id}`);

  const after = await loadPayDays(view.runId, view.employee.id, { canEditAttendance: true, canEditPayroll: true });
  if ("error" in after) return { error: after.error };
  return { error: null, view: after.view };
}

/** Hourly workers are paid from the timesheet, so a day is edited on the timesheet itself, then the run is recalculated. */
async function applyTimesheetDay(g: Exclude<Awaited<ReturnType<typeof guard>>, { error: string }>, date: string, value: string): Promise<Result> {
  const { user, loaded } = g;
  const view = loaded.view;
  if (!view.editable) return { error: view.why ?? "This day can't be changed." };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || date.slice(0, 7) !== view.month) return { error: "That day isn't in this payroll month." };
  const row = view.rows.find((r) => r.date === date);
  if (!row || row.kind === "outside") return { error: "They were not employed on that day." };

  const run = await prisma.payrollRun.findUnique({ where: { id: view.runId } });
  const emp = await prisma.employee.findUnique({ where: { id: view.employee.id }, select: { id: true, name: true, employeeIdNo: true, supplierId: true } });
  if (!run || !emp) return { error: "Run or employee not found." };
  const sheets = await prisma.timesheetEntry.findMany({ where: { branchId: run.branchId, employeeIdNo: emp.employeeIdNo, month: run.month }, orderBy: { updatedAt: "desc" } });
  const entry = sheets.find((x) => x.supplierId === emp.supplierId) ?? sheets[0];
  if (!entry) return { error: "There is no timesheet for this month." };
  if (entry.status === "LOCKED") return { error: "That timesheet is locked. Unlock it in Timesheets first." };

  const before = readCell(parseDailyHours(entry.dailyHours), date);
  const cells = writeCell(parseDailyHours(entry.dailyHours), date, value);
  const { totalHours, absentCount } = recompute(cells);
  await prisma.timesheetEntry.update({ where: { id: entry.id }, data: { dailyHours: JSON.stringify(cells), totalHours, absentCount, invoiceValue: Math.round(totalHours * entry.rate * 100) / 100 } });
  await logAudit({ entityType: "TIMESHEET_ENTRY", entityId: entry.id, action: "UPDATE", before: { date, value: before }, after: { date, value, source: "payroll" }, userId: user.id, userName: user.name, branchId: run.branchId });
  await rebuildRunLines(run);
  await prisma.payrollRunEvent.create({ data: { runId: run.id, action: "RECALCULATED", note: `${emp.name}: timesheet ${date} changed to ${value || "blank"}`, userId: user.id, userName: user.name } });
  revalidatePath(`/payroll/${run.id}`);

  const after = await loadPayDays(view.runId, view.employee.id, { canEditAttendance: true, canEditPayroll: true });
  if ("error" in after) return { error: after.error };
  return { error: null, view: after.view };
}

export async function saveDayAction(formData: FormData): Promise<Result> {
  assertContactsValid(formData);
  const g = await guard(String(formData.get("runId") || ""), String(formData.get("employeeId") || ""));
  if ("error" in g) return { error: g.error ?? "Not allowed." };
  if (g.loaded.view.hourly) {
    const status = String(formData.get("status") || "");
    const h = hours(formData.get("normalHours"));
    if (status === "PRESENT" && (h === null || Number.isNaN(h) || h <= 0)) return { error: "Enter the hours worked, between 0 and 24." };
    const value = status === "PRESENT" ? String(h) : ({ ABSENT: "A", OFF: "OFF", HOLIDAY: "H", LEAVE: "L", SICK_LEAVE: "SL", IDLE: "I" } as Record<string, string>)[status];
    if (value === undefined) return { error: "Choose what happened that day." };
    return applyTimesheetDay(g, String(formData.get("date") || ""), value);
  }
  const status = String(formData.get("status") || "");
  if (!STATUSES.has(status)) return { error: "Choose what happened that day." };
  const normal = hours(formData.get("normalHours"));
  const ot = hours(formData.get("otHours"));
  if (Number.isNaN(normal) || Number.isNaN(ot)) return { error: "Hours must be between 0 and 24." };
  const worked = status === "PRESENT";
  return applyDay(g, String(formData.get("date") || ""), { status, normalHours: worked ? normal : null, otHours: worked ? ot : null }, "payroll");
}

/** Copies what the client timesheet says for one day into attendance. */
export async function alignDayAction(formData: FormData): Promise<Result> {
  assertContactsValid(formData);
  const g = await guard(String(formData.get("runId") || ""), String(formData.get("employeeId") || ""));
  if ("error" in g) return { error: g.error ?? "Not allowed." };
  const date = String(formData.get("date") || "");
  const view = g.loaded.view;
  const sheet = await prisma.timesheetEntry.findMany({ where: { branchId: g.branchId, employeeIdNo: view.employee.idNo, month: view.month }, orderBy: { updatedAt: "desc" }, select: { dailyHours: true } });
  const value = sheet[0] ? readCell(parseDailyHours(sheet[0].dailyHours), date) : null;
  const next = attendanceFromCell(value, view.dailyHours);
  if (!next) return { error: "The timesheet has nothing for that day to copy." };
  return applyDay(g, date, next, "timesheet");
}
