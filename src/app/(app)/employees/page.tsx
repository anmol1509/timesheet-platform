import Link from "next/link";
import { UserPlus, X } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/Button";
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
    <div className="space-y-5">
      <PageHeader
        title="Employees"
        description="Workers on record, with compliance status and current deployment. New employees are created automatically when their ID appears in a timesheet upload."
        meta={
          <span className="tabular rounded-md bg-surface-sunken px-1.5 py-0.5 text-xs font-medium text-secondary">
            {employees.length}
          </span>
        }
        actions={
          <Button href="/employees/new" size="sm">
            <UserPlus className="h-3.5 w-3.5" aria-hidden />
            Add employee
          </Button>
        }
      />

      {entityFilter && (
        <div className="flex items-center gap-1.5 self-start rounded-control bg-brand-soft py-1 pr-1 pl-2.5 text-xs font-medium text-[var(--brand-primary)]">
          {entityFilter.label}: {entityFilter.name}
          <Link
            href="/employees"
            className="rounded-xs p-0.5 transition hover:bg-white/70"
            aria-label="Clear filter"
          >
            <X className="h-3 w-3" />
          </Link>
        </div>
      )}

      <EmployeeList employees={rows} initialFilter={filter} />
    </div>
  );
}
