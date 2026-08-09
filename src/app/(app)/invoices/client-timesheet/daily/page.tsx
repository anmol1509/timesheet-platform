import { prisma } from "@/lib/db";
import { requireUserWithBranch } from "@/lib/auth";
import { branchWhere } from "@/lib/branch";
import { DailyTimesheetForm } from "./daily-timesheet-form";

export default async function DailyTimesheetPage() {
  const { branchId } = await requireUserWithBranch();

  const [suppliers, employees] = await Promise.all([
    prisma.supplier.findMany({ where: branchWhere(branchId), select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.employee.findMany({
      where: { ...branchWhere(branchId), projectId: { not: null }, supplierId: { not: null } },
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
  ]);

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Daily Timesheet</h1>
        <p className="mt-1 text-sm text-slate-500">
          Pick a supplier and project to log just today&rsquo;s hours for that supplier&rsquo;s employees.
        </p>
      </div>

      <DailyTimesheetForm
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
    </div>
  );
}
