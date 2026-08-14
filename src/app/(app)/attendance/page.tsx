import { prisma } from "@/lib/db";
import { requireUserWithBranch } from "@/lib/auth";
import { branchWhere } from "@/lib/branch";
import { AttendanceForm } from "./attendance-form";
import { CorrectionRequests } from "./correction-requests";

export default async function AttendancePage() {
  const { branchId } = await requireUserWithBranch();

  const [suppliers, employees, pendingCorrections] = await Promise.all([
    prisma.supplier.findMany({ where: branchWhere(branchId), select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.employee.findMany({
      where: { ...branchWhere(branchId), projectId: { not: null }, supplierId: { not: null }, status: "ACTIVE" },
      select: {
        id: true,
        name: true,
        employeeIdNo: true,
        trade: true,
        supplierId: true,
        projectId: true,
        project: { select: { id: true, name: true, code: true } },
      },
      orderBy: { name: "asc" },
    }),
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

      <AttendanceForm
        suppliers={suppliers}
        employees={employees.map((e) => ({
          id: e.id,
          name: e.name,
          employeeIdNo: e.employeeIdNo,
          trade: e.trade,
          supplierId: e.supplierId as string,
          projectId: e.projectId as string,
          projectName: e.project ? `${e.project.code} — ${e.project.name}` : "",
        }))}
      />

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
