import { prisma } from "@/lib/db";
import type { DailyHourCell } from "@/lib/parseTimesheet";
import { branchWhere } from "@/lib/branch";

const DAY_LABELS = ["S", "M", "T", "W", "T", "F", "S"];

export type WeeklyHoursDay = { label: string; hours: number };

/** Total logged hours per weekday, aggregated across the most recent month with timesheet data. */
export async function getWeeklyHours(branchId: string | null = null): Promise<WeeklyHoursDay[]> {
  const where = branchWhere(branchId);
  const latest = await prisma.timesheetEntry.findFirst({
    where,
    orderBy: { month: "desc" },
    select: { month: true },
  });
  if (!latest) return DAY_LABELS.map((label) => ({ label, hours: 0 }));

  const entries = await prisma.timesheetEntry.findMany({
    where: { ...where, month: latest.month },
    select: { dailyHours: true },
  });

  const totals = Array(7).fill(0);
  for (const entry of entries) {
    let cells: DailyHourCell[];
    try {
      cells = JSON.parse(entry.dailyHours);
    } catch {
      continue;
    }
    for (const cell of cells) {
      if (!cell.date) continue;
      const value = Number(cell.value);
      if (!Number.isFinite(value) || value <= 0) continue;
      const day = new Date(cell.date).getUTCDay();
      totals[day] += value;
    }
  }

  return DAY_LABELS.map((label, i) => ({ label, hours: Math.round(totals[i]) }));
}
