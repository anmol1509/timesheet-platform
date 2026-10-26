import { prisma } from "@/lib/db";

/** TS-2026-0001: the year, then the running number padded to four digits (it grows past that without breaking). */
export const formatSheetNo = (year: number, n: number) => `TS-${year}-${String(n).padStart(4, "0")}`;

/**
 * The next timesheet number for a branch. The counter is bumped in one atomic statement, so two people generating at the same
 * moment never get the same number; a number is used up even if the file then fails, so numbers can skip but never repeat.
 */
export async function nextSheetNo(branchId: string, now: Date = new Date()): Promise<string> {
  const year = now.getFullYear();
  const row = await prisma.sheetCounter.upsert({
    where: { branchId_year: { branchId, year } },
    create: { branchId, year, last: 1 },
    update: { last: { increment: 1 } },
    select: { last: true },
  });
  return formatSheetNo(year, row.last);
}
