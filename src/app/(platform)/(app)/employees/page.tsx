import { ExpiryFix } from "./[id]/profile-fixes";
import Link from "next/link";
import { FileSearch, UserPlus } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/Button";
import { prisma } from "@/lib/db";
import { complianceStatus, daysUntil } from "@/lib/compliance";
import { requireUserWithBranch, subjectOf } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { branchWhere } from "@/lib/branch";
import { isEmployeeComplete } from "@/lib/employeeCompleteness";
import { EmployeeKpiCards } from "@/components/EmployeeKpiCards";
import { BarList } from "@/components/BarList";
import { Treemap } from "@/components/Treemap";
import { Insights } from "@/components/ListSummary";
import { EmployeeList } from "./employee-list";
import { StatusRow, type StatusItem } from "@/components/StatusRow";

export const metadata = { title: "Employees" };

const num = (d: { toString(): string } | null | undefined) => (d == null ? null : Number(d.toString()));
const STRUCTURE_LABEL: Record<string, string> = { ITEMISED: "Itemised", FLAT: "Flat", HOURLY: "Hourly" };
/** The pay columns of the sheet: the structure, the one rate that goes with it, and the allowances for itemised pay. */
function payCells(e: { dailyHours: { toString(): string } | null; paysOvertime: boolean; otMultiplier: { toString(): string } | null; restOtMultiplier: { toString(): string } | null; gasWaived: boolean; payStructure: string | null; basicSalary: { toString(): string } | null; flatMonthlyRate: { toString(): string } | null; hourlyRate: { toString(): string } | null; housingAllowance: { toString(): string } | null; foodAllowance: { toString(): string } | null; transportAllowance: { toString(): string } | null; otherAllowance: { toString(): string } | null }) {
  const rate = e.payStructure === "ITEMISED" ? num(e.basicSalary) : e.payStructure === "FLAT" ? num(e.flatMonthlyRate) : e.payStructure === "HOURLY" ? num(e.hourlyRate) : null;
  return { structure: e.payStructure ? (STRUCTURE_LABEL[e.payStructure] ?? e.payStructure) : "", rate, housing: num(e.housingAllowance), food: num(e.foodAllowance), transport: num(e.transportAllowance), other: num(e.otherAllowance), dailyHours: num(e.dailyHours), overtime: e.paysOvertime ? "Yes" : "No", otMultiplier: num(e.otMultiplier), restOtMultiplier: num(e.restOtMultiplier), gasWaived: e.gasWaived ? "Yes" : "No" };
}

const STATUS_RANK = { expired: 0, expiring: 1, not_set: 2, valid: 3 } as const;

export default async function EmployeesPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string; supplier?: string; sponsor?: string; sponsorName?: string; registered?: string; trade?: string; nationality?: string; open?: string; tab?: string; renew?: string }>;
}) {
  const { filter, supplier: supplierId, sponsor: sponsorId, sponsorName, registered, trade, nationality, open: openId, tab: openTab, renew: openRenew } = await searchParams;
  const { user, branchId } = await requireUserWithBranch();
  // Pay is only shown, exported and imported for people who may see (or edit) payroll.
  const canViewPay = can(subjectOf(user), "payroll", "view");
  const canEditPay = can(subjectOf(user), "payroll", "edit");

  const [employees] = await Promise.all([
    prisma.employee.findMany({
      where: {
        ...branchWhere(branchId),
        ...(supplierId ? { supplierId } : {}),
        ...(sponsorId ? { sponsorSupplierId: sponsorId } : {}),
        ...(sponsorName ? { sponsorName: { equals: sponsorName, mode: "insensitive" as const } } : {}),
        ...(trade ? { trade: { equals: trade, mode: "insensitive" as const } } : {}),
        ...(nationality ? { nationality: { equals: nationality, mode: "insensitive" as const } } : {}),
      },
      // The photo bytes aren't needed for a list — the avatar loads them
      // separately from /api/employees/[id]/photo, and only when one exists.
      omit: { photoData: true },
      include: {
        supplier: { include: { parent: { select: { name: true, code: true } } } },
        sponsorSupplier: { select: { name: true } },
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
  ]);

  // The choices for the filter boxes: every supplier, sponsor, trade and nationality in this company, with how many workers each has,
  // whatever is filtered right now, so another one can be picked straight away.
  const base = branchWhere(branchId);
  const [bySupplier, bySponsor, bySponsorName, optTrade, optNationality] = await Promise.all([
    prisma.employee.groupBy({ by: ["supplierId"], where: { ...base, supplierId: { not: null } }, _count: { _all: true } }),
    prisma.employee.groupBy({ by: ["sponsorSupplierId"], where: { ...base, sponsorSupplierId: { not: null } }, _count: { _all: true } }),
    prisma.employee.groupBy({ by: ["sponsorName"], where: { ...base, sponsorSupplierId: null, sponsorName: { not: null } }, _count: { _all: true } }),
    prisma.employee.groupBy({ by: ["trade"], where: { ...base, trade: { not: null } }, _count: { _all: true } }),
    prisma.employee.groupBy({ by: ["nationality"], where: { ...base, nationality: { not: null } }, _count: { _all: true } }),
  ]);
  const supplierIds = [...new Set([...bySupplier.map((g) => g.supplierId!), ...bySponsor.map((g) => g.sponsorSupplierId!)])];
  const supplierNames = new Map((supplierIds.length ? await prisma.supplier.findMany({ where: { id: { in: supplierIds } }, select: { id: true, name: true } }) : []).map((x) => [x.id, x.name]));
  const byName = (a: { label: string }, b: { label: string }) => a.label.localeCompare(b.label);
  const filterOptions = {
    suppliers: bySupplier.map((g) => ({ value: g.supplierId!, label: supplierNames.get(g.supplierId!) ?? "Unknown", count: g._count._all })).sort(byName),
    sponsors: [
      ...bySponsor.map((g) => ({ value: `s:${g.sponsorSupplierId}`, label: supplierNames.get(g.sponsorSupplierId!) ?? "Unknown", count: g._count._all })),
      ...bySponsorName.filter((g) => g.sponsorName?.trim()).map((g) => ({ value: `n:${g.sponsorName}`, label: g.sponsorName!.trim(), count: g._count._all })),
    ].sort(byName),
    trades: optTrade.filter((g) => g.trade?.trim()).map((g) => ({ value: g.trade!, label: g.trade!, count: g._count._all })).sort(byName),
    nationalities: optNationality.filter((g) => g.nationality?.trim()).map((g) => ({ value: g.nationality!, label: g.nationality!, count: g._count._all })).sort(byName),
  };
  const currentFilters = { supplier: supplierId ?? "", sponsor: sponsorId ? `s:${sponsorId}` : sponsorName ? `n:${sponsorName}` : "", trade: trade ?? "", nationality: nationality ?? "" };

  const rows = employees.map((e) => {
    const docs: [string, Date | null][] = [
      ["Visa", e.visaExpiry],
      ["Labour card", e.laborCardExpiry],
      ["Medical", e.medicalExpiry],
      ["Passport", e.passportExpiry],
      ["Emirates ID", e.emiratesIdExpiry],
    ];
    const fieldOf: Record<string, string> = { Visa: "visaExpiry", "Labour card": "laborCardExpiry", Medical: "medicalExpiry", Passport: "passportExpiry", "Emirates ID": "emiratesIdExpiry" };
    const lapsing = docs.flatMap(([label, d]) => { const st = complianceStatus(d); return st === "expired" || st === "expiring" ? [{ field: fieldOf[label], label, state: st }] : []; });
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
      addedOn: e.createdAt.toISOString(),
      name: e.name,
      hasPhoto: !!e.photoMimeType,
      category: e.category,
      trade: e.trade,
      position: e.position,
      department: e.department,
      passportNumber: e.passportNumber,
      emiratesId: e.emiratesId,
      nationality: e.nationality,
      companyDisplayName: e.supplier?.parent?.name ?? e.supplier?.name ?? null,
      companyCode: e.supplier?.parent ? (e.supplier.parent.code ?? null) : (e.supplier?.code ?? null),
      // Linked sponsor company when there is one, else the sponsor name that was typed or imported.
      sponsorName: e.sponsorSupplier?.name ?? e.sponsorName ?? null,
      isOwnCompanySupplier: !!e.supplier?.isOwnCompany,
      onWork: e.active && e.project != null,
      status: e.status,
      worstStatus,
      projectName: e.project?.name ?? null,
      campName: e.campCheckIns[0]?.camp.name ?? null,
      bedLabel: e.campCheckIns[0]?.bed ? `${e.campCheckIns[0].bed.room.name} · ${e.campCheckIns[0].bed.label}` : null,
      nextExpiry,
      lapsing,
      docCounts,
      complete: isEmployeeComplete(e),
      ...(canViewPay ? { pay: payCells(e) } : {}),
    };
  });

  const onWorkCount = rows.filter((r) => r.onWork).length;
  const benchCount = rows.length - onWorkCount;
  const complianceIssuesCount = rows.filter((r) => r.worstStatus === "expired" || r.worstStatus === "expiring").length;

  // The charts count the whole group being looked at (the company or sponsor chosen), not just the trade or nationality that
  // is filtered, so another bar can be clicked straight away and the active one stays in view.
  const scope = { ...branchWhere(branchId), ...(supplierId ? { supplierId } : {}), ...(sponsorId ? { sponsorSupplierId: sponsorId } : {}), ...(sponsorName ? { sponsorName: { equals: sponsorName, mode: "insensitive" as const } } : {}) };
  const [tradeGroups, nationalityGroups] = await Promise.all([
    prisma.employee.groupBy({ by: ["trade"], where: scope, _count: { _all: true } }),
    prisma.employee.groupBy({ by: ["nationality"], where: scope, _count: { _all: true } }),
  ]);
  const byTrade = new Map<string, number>();
  for (const g of tradeGroups) byTrade.set(g.trade?.trim() || "Not set", (byTrade.get(g.trade?.trim() || "Not set") ?? 0) + g._count._all);
  const byNationality = new Map<string, number>();
  for (const g of nationalityGroups) byNationality.set(g.nationality?.trim() || "Not set", (byNationality.get(g.nationality?.trim() || "Not set") ?? 0) + g._count._all);
  const topTrades = [...byTrade.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6);
  const nationalities = [...byNationality.entries()].sort((a, b) => b[1] - a[1]);

  // What needs attention in this list, as chips: people with expired or expiring documents, and incomplete profiles.
  const peopleList = (people: typeof rows) => (
    <ul className="divide-y divide-[var(--border)] rounded-md border border-default text-sm">
      {people.slice(0, 60).map((r) => (
        <li key={r.id} className="flex items-center justify-between gap-3 px-3 py-2">
          <Link href={`/employees/${r.id}`} className="min-w-0 truncate text-primary hover:underline">{r.name} <span className="text-xs text-subtle">{r.employeeIdNo}</span></Link>
        </li>
      ))}
      {people.length > 60 && <li className="px-3 py-2 text-xs text-muted">…and {people.length - 60} more</li>}
    </ul>
  );
  // Expired / expiring: each person's lapsing documents with a new-date box, saved right there.
  const expiryList = (people: typeof rows, state: "expired" | "expiring") => (
    <ul className="divide-y divide-[var(--border)] rounded-md border border-default text-sm">
      {people.slice(0, 40).map((r) => (
        <li key={r.id} className="space-y-1 px-3 py-2">
          <Link href={`/employees/${r.id}`} className="block truncate text-primary hover:underline">{r.name} <span className="text-xs text-subtle">{r.employeeIdNo}</span></Link>
          {r.lapsing.filter((l) => l.state === state).map((l) => (
            <div key={l.field}><span className="text-xs text-muted">{l.label}</span><ExpiryFix employeeId={r.id} field={l.field} current="" /></div>
          ))}
        </li>
      ))}
      {people.length > 40 && <li className="px-3 py-2 text-xs text-muted">…and {people.length - 40} more: use Review renewals</li>}
    </ul>
  );
  const statusItems: StatusItem[] = [];
  const expiredPeople = rows.filter((r) => r.worstStatus === "expired");
  const expiringPeople = rows.filter((r) => r.worstStatus === "expiring");
  const incompletePeople = rows.filter((r) => !r.complete);
  if (expiredPeople.length > 0) statusItems.push({ key: "expired", tone: "danger", label: `${expiredPeople.length} with an expired document`, title: "Expired documents", description: "Renew them before they affect payroll or deployment.", content: <div className="space-y-3">{expiryList(expiredPeople, "expired")}<Link href="/employees/renewals" className="btn btn-secondary inline-flex">Review renewals</Link></div> });
  if (expiringPeople.length > 0) statusItems.push({ key: "expiring", tone: "warn", label: `${expiringPeople.length} expiring soon`, title: "Documents expiring soon", content: <div className="space-y-3">{expiryList(expiringPeople, "expiring")}<Link href="/employees/renewals" className="btn btn-secondary inline-flex">Review renewals</Link></div> });
  if (incompletePeople.length > 0) statusItems.push({ key: "incomplete", tone: "info", label: `${incompletePeople.length} incomplete profiles`, title: "Incomplete profiles", description: "Some details are missing. Open a person to fill them in.", content: <div className="space-y-3">{peopleList(incompletePeople)}<Link href="/employees?filter=incomplete" className="btn btn-secondary inline-flex">Show them in the list</Link></div> });

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
          <>
            <Button href="/employees/instant-view" size="sm" variant="secondary">
              <FileSearch className="h-3.5 w-3.5" aria-hidden />
              Instant view
            </Button>
            <Button href="/data-health" size="sm" variant="secondary">
              Data health
            </Button>
            <Button href="/employees/new" size="sm">
              <UserPlus className="h-3.5 w-3.5" aria-hidden />
              Add employee
            </Button>
          </>
        }
      />

      <StatusRow items={statusItems} hideWhenClear label="Needs attention in this list" />

      <EmployeeKpiCards
        total={rows.length}
        onWork={onWorkCount}
        bench={benchCount}
        complianceIssues={complianceIssuesCount}
      />

      {rows.length > 0 && (
        <Insights id="employees" title="Workforce breakdown" hint="Explore trades and nationalities">
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <div>
              <h3 className="mb-3 text-sm font-semibold text-primary">By trade</h3>
              <BarList
                tone="brand"
                items={topTrades.map(([label, count]) => ({ key: label, label, value: count, href: label === "Not set" ? undefined : `/employees?trade=${encodeURIComponent(label)}` }))}
              />
            </div>
            <div>
              <h3 className="mb-3 text-sm font-semibold text-primary">By nationality</h3>
              <Treemap items={nationalities.map(([label, count]) => ({ key: label, label, value: count, href: label === "Not set" ? undefined : `/employees?nationality=${encodeURIComponent(label)}` }))} />
            </div>
          </div>
        </Insights>
      )}

      <EmployeeList key={openId ?? "list"} employees={rows} filterOptions={filterOptions} currentFilters={currentFilters} initialFilter={filter} registeredId={registered} canViewPay={canViewPay} canEditPay={canEditPay} initialOpen={openId ? { id: openId, tab: openTab, renew: openRenew } : undefined} />
    </div>
  );
}
