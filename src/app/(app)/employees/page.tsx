import Link from "next/link";
import { X } from "lucide-react";
import { prisma } from "@/lib/db";
import { complianceStatus } from "@/lib/compliance";
import { requireUserWithBranch } from "@/lib/auth";
import { branchWhere } from "@/lib/branch";
import { isEmployeeComplete } from "@/lib/employeeCompleteness";
import { EmployeeList } from "./employee-list";

const STATUS_RANK = { expired: 0, expiring: 1, not_set: 2, valid: 3 } as const;

export default async function EmployeesPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string; supplier?: string; sponsor?: string }>;
}) {
  const { filter, supplier: supplierId, sponsor: sponsorId } = await searchParams;
  const { branchId } = await requireUserWithBranch();

  const [employees, entityFilter] = await Promise.all([
    prisma.employee.findMany({
      where: {
        ...branchWhere(branchId),
        ...(supplierId ? { supplierId } : {}),
        ...(sponsorId ? { sponsorshipCompanyId: sponsorId } : {}),
      },
      include: {
        supplier: { include: { parent: { select: { name: true } } } },
        project: { select: { name: true } },
        documents: { select: { type: true } },
      },
      orderBy: { name: "asc" },
    }),
    supplierId
      ? prisma.supplier.findUnique({ where: { id: supplierId }, select: { name: true } }).then(
          (s) => (s ? { label: "Supplier", name: s.name } : null)
        )
      : sponsorId
        ? prisma.sponsorshipCompany
            .findUnique({ where: { id: sponsorId }, select: { name: true } })
            .then((s) => (s ? { label: "Sponsorship company", name: s.name } : null))
        : Promise.resolve(null),
  ]);

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
      companyDisplayName: e.supplier?.parent?.name ?? e.supplier?.name ?? null,
      onWork: e.active && e.project != null,
      status: e.status,
      worstStatus,
      complete: isEmployeeComplete(e),
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

      {entityFilter && (
        <div className="flex items-center gap-1.5 self-start rounded-full bg-[var(--brand-primary-soft)] py-1 pr-1 pl-3 text-xs font-medium text-[var(--brand-primary)]">
          {entityFilter.label}: {entityFilter.name}
          <Link
            href="/employees"
            className="rounded-full p-1 hover:bg-white/60"
            aria-label="Clear filter"
          >
            <X className="h-3 w-3" />
          </Link>
        </div>
      )}

      {rows.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-slate-300 bg-white px-6 py-14 text-center">
          <p className="text-sm text-slate-500">
            {entityFilter ? (
              "No employees match this filter."
            ) : (
              <>
                No employees yet.{" "}
                <Link href="/upload" className="font-medium text-slate-900 underline">
                  Upload a time sheet
                </Link>{" "}
                to populate this list automatically.
              </>
            )}
          </p>
        </div>
      ) : (
        <EmployeeList employees={rows} initialFilter={filter} />
      )}
    </div>
  );
}
