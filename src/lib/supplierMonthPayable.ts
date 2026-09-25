import { prisma } from "@/lib/db";

export type TradeLine = { trade: string; rate: number; hours: number; amount: number };
export type SupplierMonthPayable = {
  entryCount: number;
  hours: number;
  gross: number; // sum of hours x rate
  absentDeduction: number; // sum of the per-row absence deductions
  gasDeduction: number; // entered when the payout sheet was generated
  net: number; // what the timesheet says we owe the supplier
  byTrade: TradeLine[];
  notFinal: number; // rows not yet approved, so the figure may still move
};

const r2 = (n: number) => Math.round((n + Math.sign(n) * Number.EPSILON) * 100) / 100;

/**
 * The timesheet's figure for one supplier and month, using the same arithmetic
 * as the supplier payout sheet: hours x rate per row, less each row's absence
 * deduction, less the gas deduction. Pure, so it can be tested and reused.
 */
export function summariseSupplierMonth(
  entries: { trade: string; rate: number; totalHours: number; absentDeduction: number; status: string }[],
  gasDeduction: number
): SupplierMonthPayable {
  const byKey = new Map<string, TradeLine>();
  let hours = 0, gross = 0, absent = 0, notFinal = 0;
  for (const e of entries) {
    hours += e.totalHours;
    gross += e.totalHours * e.rate;
    absent += e.absentDeduction || 0;
    if (e.status === "DRAFT" || e.status === "SUBMITTED" || e.status === "UNDER_REVIEW") notFinal++;
    const key = `${e.trade}__${e.rate}`;
    const line = byKey.get(key) ?? { trade: e.trade, rate: e.rate, hours: 0, amount: 0 };
    line.hours += e.totalHours;
    line.amount += e.totalHours * e.rate;
    byKey.set(key, line);
  }
  const g = r2(gross), a = r2(absent), gas = r2(gasDeduction || 0);
  return {
    entryCount: entries.length, hours: r2(hours), gross: g, absentDeduction: a, gasDeduction: gas, net: r2(g - a - gas),
    byTrade: [...byKey.values()].map((l) => ({ ...l, hours: r2(l.hours), amount: r2(l.amount) })).sort((x, y) => x.trade.localeCompare(y.trade)),
    notFinal,
  };
}

/** Loads a supplier's month and summarises it. The gas deduction is the latest one entered for that month. */
export async function loadSupplierMonthPayable(supplierId: string, month: string): Promise<SupplierMonthPayable> {
  const [entries, sheet] = await Promise.all([
    prisma.timesheetEntry.findMany({ where: { supplierId, month }, select: { trade: true, rate: true, totalHours: true, absentDeduction: true, status: true } }),
    prisma.generatedSheet.findFirst({ where: { supplierId, month }, orderBy: { generatedAt: "desc" }, select: { gasDeduction: true } }),
  ]);
  return summariseSupplierMonth(entries, sheet?.gasDeduction ?? 0);
}
