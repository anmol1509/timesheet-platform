import { Upload, Users } from "lucide-react";
import { isAdminRole } from "@/lib/roles";
import Link from "next/link";
import { PageHeader } from "@/components/PageHeader";
import { prisma } from "@/lib/db";
import { requireUserWithBranch } from "@/lib/auth";
import { branchWhere } from "@/lib/branch";
import { monthLabelFromKey } from "@/lib/timesheetSummary";
import { Select } from "@/components/ui/Select";
import { EmployeeSheetPicker } from "./employee-picker";

export default async function EmployeeSheetsPage({ searchParams }: { searchParams: Promise<{ month?: string }> }) {
  const params = await searchParams;
  const { user, branchId } = await requireUserWithBranch();
  const canImport = isAdminRole(user.role);
  const monthRows = await prisma.timesheetEntry.findMany({ where: branchWhere(branchId), distinct: ["month"], select: { month: true }, orderBy: { month: "desc" } });
  const months = monthRows.map((m) => m.month);
  const month = params.month && months.includes(params.month) ? params.month : months[0];

  const entries = month
    ? await prisma.timesheetEntry.findMany({
        where: { month, ...branchWhere(branchId) },
        select: { employeeIdNo: true, employeeName: true, trade: true, totalHours: true, supplier: { select: { id: true, name: true, invoiceApprovalStatus: true } } },
        orderBy: [{ employeeName: "asc" }],
      })
    : [];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <PageHeader title="Timesheets by employee" icon={Users} description={<>Pick the people you need and get their timesheet in one go. Prefer a whole company? <Link href="/companies" className="font-medium text-primary underline">Generate by company</Link>.</>} />
        <div className="flex flex-wrap items-center gap-3">
          {canImport && <Link href="/import/new/timesheets" className="btn btn-secondary gap-1.5"><Upload className="h-4 w-4" aria-hidden />Import</Link>}
          {months.length > 0 && (
            <form className="flex items-center gap-2">
              <label htmlFor="month" className="text-sm text-muted">Month</label>
              <Select name="month" defaultValue={month} options={months.map((m) => ({ value: m, label: monthLabelFromKey(m) }))} />
              <button type="submit" className="btn btn-primary btn-sm">Go</button>
            </form>
          )}
        </div>
      </div>
      {entries.length === 0 ? (
        <div className="empty-state"><p className="text-sm text-muted">No timesheet data yet. <Link href="/upload" className="font-medium text-primary underline">Upload a time sheet</Link> to get started.</p></div>
      ) : (
        <EmployeeSheetPicker
          month={month!}
          rows={entries.map((e) => ({
            employeeIdNo: e.employeeIdNo, name: e.employeeName, trade: e.trade, hours: e.totalHours,
            companyId: e.supplier.id, company: e.supplier.name, approved: e.supplier.invoiceApprovalStatus === "Approved",
          }))}
        />
      )}
    </div>
  );
}
