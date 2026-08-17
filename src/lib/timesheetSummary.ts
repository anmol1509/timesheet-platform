import { prisma } from "@/lib/db";
import type { DailyHourCell } from "@/lib/parseTimesheet";

export type EntryWithDaily = Awaited<
  ReturnType<typeof getSupplierMonthEntries>
>[number];

export async function getSupplierMonthEntries(supplierId: string, month: string) {
  const entries = await prisma.timesheetEntry.findMany({
    where: { supplierId, month },
    include: { client: true, project: { select: { code: true } } },
    orderBy: [{ trade: "asc" }, { employeeName: "asc" }],
  });
  return entries.map((e) => ({
    ...e,
    dailyHours: JSON.parse(e.dailyHours) as DailyHourCell[],
  }));
}

export type TradeSummaryRow = {
  trade: string;
  rate: number;
  hours: number;
  amount: number;
};

export function buildTradeSummary(
  entries: { trade: string; rate: number; totalHours: number }[]
): TradeSummaryRow[] {
  const map = new Map<string, TradeSummaryRow>();
  for (const e of entries) {
    const key = `${e.trade}__${e.rate}`;
    const existing = map.get(key);
    if (existing) {
      existing.hours += e.totalHours;
      existing.amount += e.totalHours * e.rate;
    } else {
      map.set(key, {
        trade: e.trade,
        rate: e.rate,
        hours: e.totalHours,
        amount: e.totalHours * e.rate,
      });
    }
  }
  return [...map.values()].sort((a, b) => a.trade.localeCompare(b.trade));
}

export function monthLabelFromKey(month: string) {
  const [y, m] = month.split("-");
  const date = new Date(Number(y), Number(m) - 1, 1);
  return date.toLocaleDateString("en-US", { month: "short", year: "numeric" });
}
