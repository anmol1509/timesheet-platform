import { prisma } from "@/lib/db";
import type { ReportRange, ReportRow } from "@/lib/attendanceReport";

export const MAX_ROWS = 5000;

/** Attendance for one supplier's workers in a range, worker then date. Never reads another supplier's rows. */
export async function loadAttendanceReport(supplierId: string, range: ReportRange): Promise<{ rows: ReportRow[]; truncated: boolean }> {
  const found = await prisma.attendance.findMany({
    where: {
      employee: { supplierId },
      date: { gte: range.from, lte: range.to },
      ...(range.status === "ALL" ? {} : { status: range.status }),
    },
    orderBy: [{ employee: { name: "asc" } }, { date: "asc" }],
    take: MAX_ROWS + 1,
    select: { date: true, status: true, normalHours: true, otHours: true, employee: { select: { employeeIdNo: true, name: true } } },
  });
  const truncated = found.length > MAX_ROWS;
  const rows = found.slice(0, MAX_ROWS).map((a) => ({
    code: a.employee.employeeIdNo, name: a.employee.name, date: a.date.toISOString().slice(0, 10), status: a.status, normal: a.normalHours ?? 0, ot: a.otHours ?? 0,
  }));
  return { rows, truncated };
}
