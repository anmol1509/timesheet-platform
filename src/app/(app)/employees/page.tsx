import Link from "next/link";
import { UserPlus, X } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/Button";
import { prisma } from "@/lib/db";
import { complianceStatus, daysUntil } from "@/lib/compliance";
import { requireUserWithBranch } from "@/lib/auth";
import { branchWhere } from "@/lib/branch";
import { isEmployeeComplete } from "@/lib/employeeCompleteness";
import { EmployeeKpiCards } from "@/components/EmployeeKpiCards";
import { BarList } from "@/components/BarList";
import { Panel } from "@/components/DashboardPanel";
import { Nationality } from "@/components/Nationality";
import { EmployeeList } from "./employee-list";

const STATUS_RANK = { expired: 0, expiring: 1, not_set: 2, valid: 3 } as const;

export default async function EmployeesPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string; supplier?: string; sponsor?: string; registered?: string }>;
}) {
  const { filter, supplier: supplierId, sponsor: sponsorId, registered } = await searchParams;
  const { branchId } = await requireUserWithBranch();

  const [employees, entityFilter] = await Promise.all([
    prisma.employee.findMany({
      where: {
        ...branchWhere(branchId),
        ...(supplierId ? { supplierId } : {}),
        ...(sponsorId ? { sponsorSupplierId: sponsorId } : {}),
      },
      // The photo bytes aren't needed for a list — the avatar loads them
      // separately from /api/employees/[id]/photo, and only when one exists.
      omit: { photoData: true },
      include: {
        supplier: { include: { parent: { select: { name: true } } } },
        project: { select: { name: true } },
        documents: { select: { type: true } },
        campCheckIns: {
          where: { status: { not: "CHECKED_OUT" } },
          orderBy: { checkInDate: "desc" },
          take: 1,
          select: { camp: { select: { name: true } }, bed: { select: { label: true, room: { select: { name: true } } } } },
        },
      },
      orderBy: { name: "asc" },
    }),
    supplierId
      ? prisma.supplier.findUnique({ where: { id: supplierId }, select: { name: true } }).then(
          (s) => (s ? { label: "Supplier", name: s.name } : null)
        )
      : sponsorId
        ? prisma.supplier
            .findUnique({ where: { id: sponsorId }, select: { name: true } })
            .then((s) => (s ? { label: "Sponsor", name: s.name } : null))
        : Promise.resolve(null),
  ]);

  const rows = employees.map((e) => {
    const docs: [string, Date | null][] = [
      ["Visa", e.visaExpiry],
      ["Labour card", e.laborCardExpiry],
      ["Medical", e.medicalExpiry],
      ["Passport", e.passportExpiry],
      ["Emirates ID", e.emiratesIdExpiry],
    ];
    const dated = docs.filter((d): d is [string, Date] => d[1] !== null).sort((a, b) => a[1].getTime() - b[1].getTime());
    const nextExpiry = dated[0] ? { doc: dated[0][0], days: daysUntil(dated[0][1]) } : null;
    const statuses = docs.map(([, d]) => complianceStatus(d));
    const worstStatus = statuses.sort(
      (a, b) => STATUS_RANK[a] - STATUS_RANK[b]
    )[0];
    const docCounts = {
      valid: statuses.filter((s) => s === "valid").length,
      expiring: statuses.filter((s) => s === "expiring").length,
      expired: statuses.filter((s) => s === "expired").length,
    };
    return {
      id: e.id,
      employeeIdNo: e.employeeIdNo,
      name: e.name,
      hasPhoto: !!e.photoMimeType,
      category: e.category,
      trade: e.trade,
      passportNumber: e.passportNumber,
      emiratesId: e.emiratesId,
      nationality: e.nationality,
      companyDisplayName: e.supplier?.parent?.name ?? e.supplier?.name ?? null,
      isOwnCompanySupplier: !!e.supplier?.isOwnCompany,
      onWork: e.active && e.project != null,
      status: e.status,
      worstStatus,
      projectName: e.project?.name ?? null,
      campName: e.campCheckIns[0]?.camp.name ?? null,
      bedLabel: e.campCheckIns[0]?.bed ? `${e.campCheckIns[0].bed.room.name} · ${e.campCheckIns[0].bed.label}` : null,
      nextExpiry,
      docCounts,
      complete: isEmployeeComplete(e),
    };
  });

  const onWorkCount = rows.filter((r) => r.onWork).length;
  const benchCount = rows.length - onWorkCount;
  const complianceIssuesCount = rows.filter((r) => r.worstStatus === "expired" || r.worstStatus === "expiring").length;

  const byTrade = new Map<string, number>();
  const byNationality = new Map<string, number>();
  for (const r of rows) {
    const t = r.trade ?? "Not set";
    byTrade.set(t, (byTrade.get(t) ?? 0) + 1);
    const n = r.nationality ?? "Not set";
    byNationality.set(n, (byNationality.get(n) ?? 0) + 1);
  }
  const topTrades = [...byTrade.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6);
  const topNationalities = [...byNationality.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6);

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

      <EmployeeKpiCards
        total={rows.length}
        onWork={onWorkCount}
        bench={benchCount}
        complianceIssues={complianceIssuesCount}
      />

      {rows.length > 0 && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Panel title="By trade">
            <BarList
              tone="brand"
              items={topTrades.map(([label, count]) => ({ key: label, label, value: count }))}
            />
          </Panel>
          <Panel title="By nationality">
            <BarList
              tone="info"
              items={topNationalities.map(([label, count]) => ({ key: label, label: <Nationality name={label} />, value: count }))}
            />
          </Panel>
        </div>
      )}

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

      <EmployeeList employees={rows} initialFilter={filter} registeredId={registered} />
    </div>
  );
}
