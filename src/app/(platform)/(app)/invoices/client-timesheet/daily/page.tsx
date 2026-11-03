import { CalendarDays } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { prisma } from "@/lib/db";
import { requireUserWithBranch } from "@/lib/auth";
import { branchWhere } from "@/lib/branch";
import { DailyTimesheetForm } from "./daily-timesheet-form";

export const metadata = { title: "Daily client timesheet" };

export default async function DailyTimesheetPage() {
  const { branchId } = await requireUserWithBranch();

  const [suppliers, sites, employees, lastRows, tradePay] = await Promise.all([
    prisma.supplier.findMany({ where: branchWhere(branchId), select: { id: true, name: true, isOwnCompany: true }, orderBy: { name: "asc" } }),
    prisma.site.findMany({
      where: { project: branchWhere(branchId) },
      select: { id: true, name: true, projectId: true },
      orderBy: { name: "asc" },
    }),
    prisma.employee.findMany({
      where: { ...branchWhere(branchId), projectId: { not: null }, supplierId: { not: null } },
      select: {
        id: true,
        name: true,
        employeeIdNo: true,
        trade: true,
        supplierId: true,
        projectId: true,
        hourlyRate: true,
        skills: { select: { rate: true, rateType: true, skill: { select: { name: true } } } },
        project: { select: { id: true, name: true, code: true } },
      },
      orderBy: { name: "asc" },
    }),
    // The rate on each worker's most recent timesheet row, for suppliers that are not our own.
    prisma.timesheetEntry.findMany({
      where: { ...branchWhere(branchId), rate: { gt: 0 } },
      orderBy: { month: "desc" },
      distinct: ["employeeIdNo", "trade", "supplierId"],
      select: { employeeIdNo: true, trade: true, supplierId: true, rate: true },
    }),
    prisma.tradePay.findMany({ where: { ...branchWhere(branchId), hourlyRate: { not: null } }, select: { supplierId: true, trade: true, hourlyRate: true } }),
  ]);
  const norm = (v: string | null | undefined) => (v ?? "").trim().toLowerCase();
  const ownIds = new Set(suppliers.filter((s) => s.isOwnCompany).map((s) => s.id));
  // The same order the bulk grid uses: our own companies' workers at their profile rate (what payroll pays); others at the
  // last timesheet rate, then the supplier's rate for the trade, then the profile rate.
  const suggestRate = (e: (typeof employees)[number]): number => {
    const t = norm(e.trade);
    const profile = e.skills.find((k) => norm(k.skill.name) === t && (k.rate ?? 0) > 0 && (!k.rateType || k.rateType === "HOURLY"))?.rate ?? Number(e.hourlyRate ?? 0);
    if (ownIds.has(e.supplierId as string) && profile > 0) return profile;
    const last = lastRows.find((l) => l.employeeIdNo === e.employeeIdNo && norm(l.trade) === t && l.supplierId === e.supplierId);
    if (last && last.rate > 0) return last.rate;
    const sup = tradePay.find((p) => p.supplierId === e.supplierId && norm(p.trade) === t);
    if (sup && Number(sup.hourlyRate) > 0) return Number(sup.hourlyRate);
    return profile > 0 ? profile : 0;
  };

  return (
    <div className="max-w-3xl space-y-6">
      <PageHeader
        title="Daily Timesheet"
        icon={CalendarDays}
        description={<>Pick a supplier and project to log just today&rsquo;s hours for that supplier&rsquo;s employees.</>}
      />

      <DailyTimesheetForm
        suppliers={suppliers}
        sites={sites}
        employees={employees.map((e) => ({
          id: e.id,
          name: e.name,
          employeeIdNo: e.employeeIdNo,
          trade: e.trade,
          supplierId: e.supplierId as string,
          projectId: e.projectId as string,
          projectName: e.project ? `${e.project.code}: ${e.project.name}` : "",
          suggestedRate: suggestRate(e),
        }))}
      />
    </div>
  );
}
