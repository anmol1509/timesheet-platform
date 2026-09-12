import { prisma } from "@/lib/db";
import { branchWhere } from "@/lib/branch";

export type HoursSplitDay = {
  /** ISO date, "2026-09-12". */
  date: string;
  /** Short weekday, e.g. "Sat". */
  label: string;
  normal: number;
  ot: number;
};

export type HoursSplit = {
  days: HoursSplitDay[];
  totalNormal: number;
  totalOt: number;
  /** Human-readable window, e.g. "30 Aug – 12 Sep". Null when there's no data. */
  periodLabel: string | null;
};

const WINDOW_DAYS = 14;

const EMPTY: HoursSplit = { days: [], totalNormal: 0, totalOt: 0, periodLabel: null };

function isoDate(d: Date) {
  return d.toISOString().slice(0, 10);
}

function shortDate(d: Date) {
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
}

/**
 * Normal vs overtime hours per day over the two weeks ending on the most
 * recent day attendance was recorded.
 *
 * Anchored to the latest recorded day rather than to today: attendance is
 * entered in batches, so a fixed "last 14 days" window would read as empty
 * whenever entry lags, even though the data exists.
 */
export async function getHoursSplit(branchId: string | null = null): Promise<HoursSplit> {
  const where = branchWhere(branchId);

  const latest = await prisma.attendance.findFirst({
    where,
    orderBy: { date: "desc" },
    select: { date: true },
  });
  if (!latest) return EMPTY;

  const end = latest.date;
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - (WINDOW_DAYS - 1));

  const records = await prisma.attendance.findMany({
    where: { ...where, date: { gte: start, lte: end } },
    select: { date: true, normalHours: true, otHours: true },
  });

  const byDate = new Map<string, { normal: number; ot: number }>();
  for (let i = 0; i < WINDOW_DAYS; i++) {
    const day = new Date(start);
    day.setUTCDate(day.getUTCDate() + i);
    byDate.set(isoDate(day), { normal: 0, ot: 0 });
  }

  for (const record of records) {
    const slot = byDate.get(isoDate(record.date));
    if (!slot) continue;
    slot.normal += record.normalHours ?? 0;
    slot.ot += record.otHours ?? 0;
  }

  const days: HoursSplitDay[] = [...byDate.entries()].map(([date, value]) => ({
    date,
    label: new Date(date).toLocaleDateString("en-GB", { weekday: "short", timeZone: "UTC" }),
    normal: Math.round(value.normal * 10) / 10,
    ot: Math.round(value.ot * 10) / 10,
  }));

  const totalNormal = days.reduce((sum, d) => sum + d.normal, 0);
  const totalOt = days.reduce((sum, d) => sum + d.ot, 0);
  if (totalNormal === 0 && totalOt === 0) return EMPTY;

  return {
    days,
    totalNormal: Math.round(totalNormal * 10) / 10,
    totalOt: Math.round(totalOt * 10) / 10,
    periodLabel: `${shortDate(start)} – ${shortDate(end)}`,
  };
}
