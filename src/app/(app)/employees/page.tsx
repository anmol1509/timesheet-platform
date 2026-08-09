import Link from "next/link";
import { prisma } from "@/lib/db";
import { complianceStatus } from "@/lib/compliance";
import { requireUserWithBranch } from "@/lib/auth";
import { branchWhere } from "@/lib/branch";
import { EmployeeList } from "./employee-list";

const STATUS_RANK = { expired: 0, expiring: 1, not_set: 2, valid: 3 } as const;

export default async function EmployeesPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string }>;
}) {
  const { filter } = await searchParams;
  const { branchId } = await requireUserWithBranch();
  const employees = await prisma.employee.findMany({
    where: branchWhere(branchId),
    include: {
      supplier: true,
      project: { select: { name: true } },
    },
    orderBy: { name: "asc" },
  });

  const rows = employees.map((e) => {
    const statuses = [
      complianceStatus(e.visaExpiry),
      complianceStatus(e.laborCardExpiry),
      complianceStatus(e.medicalExpiry),
      complianceStatus(e.passportExpiry),
      complianceStatus(e.emiratesIdExpiry),
    ];
    const worstStatus = statuses.sort(
      (a, b) => STATUS_RANK[a] - STATUS_RANK[b]
    )[0];
    return {
      id: e.id,
      employeeIdNo: e.employeeIdNo,
      name: e.name,
      category: e.category,
      trade: e.trade,
      passportNumber: e.passportNumber,
      emiratesId: e.emiratesId,
      nationality: e.nationality,
      supplierName: e.supplier?.name ?? null,
      onWork: e.active && e.project != null,
      worstStatus,
    };
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Employees</h1>
          <p className="mt-1 text-sm text-slate-500">
            {employees.length} workers on record. New employees appear here
            automatically when their ID shows up in an upload.
          </p>
        </div>
        <Link
          href="/employees/new"
          className="rounded-lg bg-[var(--brand-primary)] px-4 py-2 text-sm font-medium text-white transition hover:bg-[var(--brand-primary-hover)]"
        >
          + Add Employee
        </Link>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-slate-300 bg-white px-6 py-14 text-center">
          <p className="text-sm text-slate-500">
            No employees yet.{" "}
            <Link href="/upload" className="font-medium text-slate-900 underline">
              Upload a time sheet
            </Link>{" "}
            to populate this list automatically.
          </p>
        </div>
      ) : (
        <EmployeeList employees={rows} initialFilter={filter} />
      )}
    </div>
  );
}
