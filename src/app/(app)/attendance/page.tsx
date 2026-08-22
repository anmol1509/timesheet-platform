import { prisma } from "@/lib/db";
import { requireUserWithBranch } from "@/lib/auth";
import { branchWhere } from "@/lib/branch";
import { AttendanceForm } from "./attendance-form";
import { AttendanceCalendar } from "./attendance-calendar";
import { getAttendanceMonth } from "@/lib/attendanceMonth";
import { CorrectionRequests } from "./correction-requests";

export default async function AttendancePage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string; date?: string }>;
}) {
  const { month: monthParam, date: dateParam } = await searchParams;
  const { branchId } = await requireUserWithBranch();

  const today = new Date();
  const month = /^\d{4}-\d{2}$/.test(monthParam ?? "")
    ? monthParam!
    : `${today.getUTCFullYear()}-${String(today.getUTCMonth() + 1).padStart(2, "0")}`;
  const selectedDate = /^\d{4}-\d{2}-\d{2}$/.test(dateParam ?? "") ? dateParam! : null;

  const [suppliers, clients, employees, projects, sites, monthDays, pendingCorrections] =
    await Promise.all([
    prisma.supplier.findMany({
      where: branchWhere(branchId),
      select: { id: true, name: true, parentSupplierId: true },
      orderBy: { name: "asc" },
    }),
    // Attendance is ultimately billed to a client, so that is the filter people
    // reach for; a worker reaches one through their project.
    prisma.client.findMany({
      where: branchWhere(branchId),
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    // The whole roster: attendance is marked for everyone on the books, and
    // requiring a project and supplier hid the people most likely to be missed.
    prisma.employee.findMany({
      where: { ...branchWhere(branchId), active: true },
      select: {
        id: true,
        name: true,
        employeeIdNo: true,
        trade: true,
        status: true,
        supplierId: true,
        supplier: { select: { name: true } },
        projectId: true,
        siteId: true,
        project: { select: { id: true, name: true, code: true, clientId: true } },
      },
      orderBy: { name: "asc" },
    }),
    prisma.project.findMany({
      where: branchWhere(branchId),
      select: { id: true, name: true, code: true, clientId: true },
      orderBy: { name: "asc" },
    }),
    prisma.site.findMany({
      where: { project: branchWhere(branchId) },
      select: { id: true, name: true, projectId: true },
      orderBy: { name: "asc" },
    }),
    getAttendanceMonth(branchId, month),
    prisma.attendanceCorrectionRequest.findMany({
      where: { status: "PENDING", attendance: branchWhere(branchId) },
      include: {
        attendance: { include: { employee: { select: { name: true, employeeIdNo: true } } } },
      },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl tracking-tight text-primary font-semibold">Daily Attendance</h1>
        <p className="mt-1 text-sm text-muted">
          Mark Present/Absent/Leave/Holiday/Off per employee per day, then submit the day for
          approval to lock it.
        </p>
      </div>

      <AttendanceCalendar month={month} days={monthDays} selectedDate={selectedDate} />

      {selectedDate ? (
        <AttendanceForm
          date={selectedDate}
          suppliers={suppliers.map((s) => ({
            id: s.id,
            name: s.name,
            parentId: s.parentSupplierId,
          }))}
          clients={clients}
          projects={projects.map((p) => ({
            id: p.id,
            label: `${p.code} — ${p.name}`,
            clientId: p.clientId,
          }))}
          sites={sites.map((x) => ({ id: x.id, label: x.name, projectId: x.projectId }))}
          employees={employees.map((e) => ({
            id: e.id,
            name: e.name,
            employeeIdNo: e.employeeIdNo,
            trade: e.trade,
            status: e.status,
            supplierId: e.supplierId,
            supplierName: e.supplier?.name ?? null,
            projectId: e.projectId,
            clientId: e.project?.clientId ?? null,
            projectName: e.project ? `${e.project.code} — ${e.project.name}` : "",
            siteId: e.siteId,
          }))}
        />
      ) : (
        <p className="card p-6 text-center text-sm text-muted">
          Pick a day on the calendar to mark attendance.
        </p>
      )}

      {pendingCorrections.length > 0 && (
        <CorrectionRequests
          corrections={pendingCorrections.map((c) => ({
            id: c.id,
            reason: c.reason,
            requestedStatus: c.requestedStatus,
            requestedNormalHours: c.requestedNormalHours,
            requestedOtHours: c.requestedOtHours,
            employeeName: c.attendance.employee.name,
            employeeIdNo: c.attendance.employee.employeeIdNo,
            date: c.attendance.date.toISOString().slice(0, 10),
          }))}
        />
      )}
    </div>
  );
}
