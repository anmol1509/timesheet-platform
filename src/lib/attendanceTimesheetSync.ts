import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import {
  attendanceCellValue,
  buildMonthCells,
  cellsDiffer,
  isTimesheetOpen,
  parseDailyHours,
  readCell,
  recompute,
  storedMonthLabel,
  writeCell,
} from "@/lib/timesheetCells";

/**
 * Keeping the client timesheet in step with what attendance actually recorded.
 *
 * The two were entered separately: a supervisor marked the day on Daily
 * Attendance, and somebody else typed the same numbers into the client sheet
 * later. Two people entering one fact is how the two ended up disagreeing at
 * month end with no way to tell which was right.
 *
 * Attendance is now the source, and it writes the day's cell into that month's
 * TimesheetEntry. What it will not do is overwrite a sheet that has already
 * gone to the client — see OPEN_TIMESHEET_STATUSES. Those are reported as
 * divergences instead, so the disagreement is visible and somebody decides.
 */

export type SyncContext = {
  branchId: string;
  userId: string;
  userName: string;
  /** Locked sheets stay locked for everyone; this only widens branch access. */
  isSuperAdmin: boolean;
};

export type SyncResult = {
  /** Cells written into an open sheet. */
  written: number;
  /** TimesheetEntry rows created because the month had none for that worker. */
  created: number;
  /** Cells left alone on a sent sheet that now disagree with attendance. */
  diverged: number;
  /** Workers with no supplier — a timesheet row cannot be keyed without one. */
  skippedNoSupplier: number;
  /** Workers with no trade — likewise part of the key. */
  skippedNoTrade: number;
  /** Rows created with no rate to inherit; they need one before invoicing. */
  createdWithoutRate: number;
};

const EMPTY: SyncResult = {
  written: 0,
  created: 0,
  diverged: 0,
  skippedNoSupplier: 0,
  skippedNoTrade: 0,
  createdWithoutRate: 0,
};

/**
 * A billing rate for a row attendance is creating from scratch.
 *
 * Attendance knows nothing about money, so the rate is inherited: the most
 * recent sheet for the same worker and trade, else the rate on the trade they
 * hold. Zero is the honest last resort — the row still has to exist so the
 * hours are not lost, and the caller reports how many need a rate.
 */
async function inheritRate(employeeId: string, employeeIdNo: string, trade: string) {
  const previous = await prisma.timesheetEntry.findFirst({
    where: { employeeIdNo, trade, rate: { gt: 0 } },
    orderBy: { month: "desc" },
    select: { rate: true },
  });
  if (previous) return previous.rate;

  const skill = await prisma.employeeSkill.findFirst({
    where: { employeeId, rate: { gt: 0 }, skill: { name: { equals: trade, mode: "insensitive" } } },
    select: { rate: true },
  });
  return skill?.rate ?? 0;
}

/**
 * Writes one day of attendance into each worker's client timesheet.
 *
 * Called after attendance is saved, with the same ids that were just marked.
 */
export async function syncAttendanceDay(
  date: string,
  employeeIds: string[],
  ctx: SyncContext
): Promise<SyncResult> {
  if (employeeIds.length === 0 || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return { ...EMPTY };

  const result = { ...EMPTY };
  const month = date.slice(0, 7);
  const dateValue = new Date(date + "T00:00:00.000Z");

  const attendance = await prisma.attendance.findMany({
    where: { employeeId: { in: employeeIds }, date: dateValue, branchId: ctx.branchId },
    select: {
      status: true,
      normalHours: true,
      otHours: true,
      projectId: true,
      supplierId: true,
      employee: {
        select: {
          id: true,
          employeeIdNo: true,
          name: true,
          trade: true,
          supplierId: true,
          projectId: true,
          siteId: true,
        },
      },
    },
  });

  for (const row of attendance) {
    const value = attendanceCellValue(row);
    if (value === null) continue;

    const employee = row.employee;
    const trade = employee.trade;
    if (!trade) {
      result.skippedNoTrade++;
      continue;
    }
    // The attendance row's own supplier wins: a worker can be marked against a
    // different supplier for a day, and the sheet follows the day's work.
    const supplierId = row.supplierId ?? employee.supplierId;
    if (!supplierId) {
      result.skippedNoSupplier++;
      continue;
    }

    const existing = await prisma.timesheetEntry.findUnique({
      where: {
        month_supplierId_employeeIdNo_trade: {
          month,
          supplierId,
          employeeIdNo: employee.employeeIdNo,
          trade,
        },
      },
    });

    if (existing) {
      const days = parseDailyHours(existing.dailyHours);
      const current = readCell(days, date);

      if (!isTimesheetOpen(existing.status)) {
        // Already with the client. Left exactly as it is; only counted so the
        // caller can say the sheet and the roster no longer agree.
        if (cellsDiffer(current, value)) result.diverged++;
        continue;
      }
      if (!cellsDiffer(current, value)) continue;

      const patched = writeCell(days, date, value);
      const { totalHours, absentCount } = recompute(patched);
      await prisma.timesheetEntry.update({
        where: { id: existing.id },
        data: {
          dailyHours: JSON.stringify(patched),
          totalHours,
          absentCount,
          invoiceValue: existing.rate * totalHours,
        },
      });

      await logAudit({
        entityType: "TIMESHEET_ENTRY",
        entityId: existing.id,
        action: "UPDATE",
        before: { date, value: current, totalHours: existing.totalHours },
        after: { date, value, totalHours, source: "ATTENDANCE" },
        userId: ctx.userId,
        userName: ctx.userName,
        branchId: ctx.branchId,
      });
      result.written++;
      continue;
    }

    const projectId = row.projectId ?? employee.projectId;
    const project = projectId
      ? await prisma.project.findUnique({
          where: { id: projectId },
          select: { name: true, clientId: true },
        })
      : null;

    const rate = await inheritRate(employee.id, employee.employeeIdNo, trade);
    const cells = writeCell(buildMonthCells(month), date, value);
    const { totalHours, absentCount } = recompute(cells);

    const created = await prisma.timesheetEntry.create({
      data: {
        month,
        monthLabel: storedMonthLabel(month),
        employeeIdNo: employee.employeeIdNo,
        employeeName: employee.name,
        trade,
        rate,
        dailyHours: JSON.stringify(cells),
        totalHours,
        absentCount,
        invoiceValue: rate * totalHours,
        branchId: ctx.branchId,
        supplierId,
        clientId: project?.clientId ?? null,
        projectId: projectId ?? null,
        site: project?.name ?? null,
        siteId: employee.siteId,
      },
    });

    await logAudit({
      entityType: "TIMESHEET_ENTRY",
      entityId: created.id,
      action: "CREATE",
      after: { month, employeeIdNo: employee.employeeIdNo, trade, date, value, source: "ATTENDANCE" },
      userId: ctx.userId,
      userName: ctx.userName,
      branchId: ctx.branchId,
    });

    result.written++;
    result.created++;
    if (rate === 0) result.createdWithoutRate++;
  }

  return result;
}

export type Divergence = {
  entryId: string | null;
  employeeId: string;
  employeeIdNo: string;
  employeeName: string;
  trade: string;
  date: string;
  attendanceValue: string;
  timesheetValue: string | null;
  entryStatus: string | null;
  clientName: string | null;
  projectLabel: string | null;
  /** False once the sheet has gone to the client, or no row exists to write to. */
  fixable: boolean;
};

/**
 * Every day in a month where attendance and the client timesheet disagree.
 *
 * Derived on demand rather than stored, so it cannot itself go stale — the
 * whole point is that it reports the current state of two records that are
 * meant to say the same thing.
 */
export async function findDivergences(opts: {
  branchId: string;
  month: string;
  clientId?: string;
  projectId?: string;
}): Promise<Divergence[]> {
  const { branchId, month, clientId, projectId } = opts;
  if (!/^\d{4}-\d{2}$/.test(month)) return [];

  const [year, monthNum] = month.split("-").map(Number);
  const start = new Date(Date.UTC(year, monthNum - 1, 1));
  const end = new Date(Date.UTC(year, monthNum, 1));

  const attendance = await prisma.attendance.findMany({
    where: {
      branchId,
      date: { gte: start, lt: end },
      ...(projectId ? { employee: { projectId } } : {}),
      ...(clientId ? { employee: { project: { clientId } } } : {}),
    },
    select: {
      date: true,
      status: true,
      normalHours: true,
      otHours: true,
      supplierId: true,
      employee: {
        select: {
          id: true,
          employeeIdNo: true,
          name: true,
          trade: true,
          supplierId: true,
          project: { select: { code: true, name: true, client: { select: { name: true } } } },
        },
      },
    },
    orderBy: [{ date: "asc" }],
  });
  if (attendance.length === 0) return [];

  const entries = await prisma.timesheetEntry.findMany({
    where: { branchId, month, employeeIdNo: { in: attendance.map((a) => a.employee.employeeIdNo) } },
    select: { id: true, employeeIdNo: true, trade: true, supplierId: true, dailyHours: true, status: true },
  });
  const entryByKey = new Map(
    entries.map((e) => [`${e.supplierId}|${e.employeeIdNo}|${e.trade}`, e] as const)
  );
  // Parsed once per entry rather than once per day, which is 30x fewer.
  const daysByEntry = new Map(entries.map((e) => [e.id, parseDailyHours(e.dailyHours)] as const));

  const out: Divergence[] = [];
  for (const a of attendance) {
    const value = attendanceCellValue(a);
    if (value === null) continue;
    const employee = a.employee;
    const trade = employee.trade;
    const supplierId = a.supplierId ?? employee.supplierId;
    if (!trade || !supplierId) continue;

    const date = a.date.toISOString().slice(0, 10);
    const entry = entryByKey.get(`${supplierId}|${employee.employeeIdNo}|${trade}`);
    const current = entry ? readCell(daysByEntry.get(entry.id) ?? [], date) : null;
    if (entry && !cellsDiffer(current, value)) continue;

    out.push({
      entryId: entry?.id ?? null,
      employeeId: employee.id,
      employeeIdNo: employee.employeeIdNo,
      employeeName: employee.name,
      trade,
      date,
      attendanceValue: value,
      timesheetValue: current,
      entryStatus: entry?.status ?? null,
      clientName: employee.project?.client.name ?? null,
      projectLabel: employee.project
        ? `${employee.project.code} — ${employee.project.name}`
        : null,
      fixable: !entry || isTimesheetOpen(entry.status),
    });
  }
  return out;
}

/**
 * Pushes every fixable divergence in a month back into the timesheets.
 *
 * Reuses the same per-day write as marking attendance, so a bulk repair and a
 * normal save can never apply different rules. Sheets already with the client
 * are skipped here exactly as they are there, and stay on the report.
 */
export async function applyDivergences(
  opts: { month: string; clientId?: string; projectId?: string },
  ctx: SyncContext
): Promise<SyncResult> {
  const divergences = await findDivergences({ branchId: ctx.branchId, ...opts });
  const byDate = new Map<string, string[]>();
  for (const d of divergences) {
    if (!d.fixable) continue;
    const list = byDate.get(d.date) ?? [];
    list.push(d.employeeId);
    byDate.set(d.date, list);
  }

  const total = { ...EMPTY };
  for (const [date, employeeIds] of byDate) {
    const r = await syncAttendanceDay(date, employeeIds, ctx);
    total.written += r.written;
    total.created += r.created;
    total.diverged += r.diverged;
    total.skippedNoSupplier += r.skippedNoSupplier;
    total.skippedNoTrade += r.skippedNoTrade;
    total.createdWithoutRate += r.createdWithoutRate;
  }
  return total;
}
