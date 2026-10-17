import { PageHeader } from "@/components/PageHeader";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { monthLabelFromKey } from "@/lib/timesheetSummary";
import { TimesheetFilters } from "./timesheet-filters";
import { requireUserWithBranch } from "@/lib/auth";
import { branchWhere } from "@/lib/branch";
import { findDivergences } from "@/lib/attendanceTimesheetSync";
import { AlertTriangle, FileSearch, Plus } from "lucide-react";
import { ClientTimesheetGrid } from "./client-timesheet-grid";

const ALL_CLIENTS = "all";

export default async function ClientTimesheetPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string; clientId?: string; project?: string; site?: string }>;
}) {
  const params = await searchParams;
  const { branchId } = await requireUserWithBranch();

  const monthRows = await prisma.timesheetEntry.findMany({
    where: { clientId: { not: null }, ...branchWhere(branchId) },
    distinct: ["month"],
    select: { month: true },
    orderBy: { month: "desc" },
  });
  const months = monthRows.map((m) => m.month);
  const selectedMonth = params.month && months.includes(params.month) ? params.month : months[0];

  const clients = selectedMonth
    ? await prisma.client.findMany({
        where: { entries: { some: { month: selectedMonth } }, ...branchWhere(branchId) },
        select: { id: true, name: true },
        orderBy: { name: "asc" },
      })
    : [];
  // "All clients" shows every client's rows for the month in one sheet, with a Client column. Editing works the same,
  // since every change is made to a single row.
  const allClients = params.clientId === ALL_CLIENTS && clients.length > 0;
  const selectedClientId = allClients
    ? ALL_CLIENTS
    : params.clientId && clients.some((c) => c.id === params.clientId)
      ? params.clientId
      : clients[0]?.id;

  const allEntries =
    selectedMonth && selectedClientId
      ? await prisma.timesheetEntry.findMany({
          where: { month: selectedMonth, clientId: allClients ? { not: null } : selectedClientId, ...branchWhere(branchId) },
          select: {
            client: { select: { name: true } },
            id: true,
            employeeIdNo: true,
            employeeName: true,
            trade: true,
            dailyHours: true,
            totalHours: true,
            absentCount: true,
            status: true,
            site: true,
            project: { select: { id: true, code: true, name: true } },
          },
          orderBy: allClients ? [{ client: { name: "asc" } }, { trade: "asc" }, { employeeName: "asc" }] : [{ trade: "asc" }, { employeeName: "asc" }],
        })
      : [];

  // Excel-uploaded rows carry no project, so it's resolved from the worker's
  // own record — otherwise the filter would have nothing to offer.
  const roster = allEntries.length
    ? await prisma.employee.findMany({
        where: { employeeIdNo: { in: allEntries.map((e) => e.employeeIdNo) } },
        select: { employeeIdNo: true, project: { select: { id: true, code: true, name: true } } },
      })
    : [];
  const projectByEmployee = new Map(
    roster.filter((r) => r.project).map((r) => [r.employeeIdNo, r.project!] as const)
  );

  const withContext = allEntries.map((e) => {
    const project = e.project ?? projectByEmployee.get(e.employeeIdNo) ?? null;
    return { ...e, clientName: e.client?.name ?? "", resolvedProject: project };
  });

  // Options come from what's actually on this month's rows, so the dropdowns
  // never offer a project or site that would return nothing.
  const projectOptions = [
    ...new Map(
      withContext
        .filter((e) => e.resolvedProject)
        .map((e) => [e.resolvedProject!.id, `${e.resolvedProject!.code} — ${e.resolvedProject!.name}`])
    ),
  ].sort((a, b) => a[1].localeCompare(b[1]));
  const siteOptions = [
    ...new Set(withContext.map((e) => e.site).filter((s): s is string => !!s && s.trim() !== "")),
  ].sort((a, b) => a.localeCompare(b));

  const selectedProject = params.project && projectOptions.some(([id]) => id === params.project)
    ? params.project
    : "";
  const selectedSite = params.site && siteOptions.includes(params.site) ? params.site : "";

  const entries = withContext
    .filter((e) => !selectedProject || e.resolvedProject?.id === selectedProject)
    .filter((e) => !selectedSite || e.site === selectedSite);

  // Attendance keeps the sheet in step on its own; only what it refused to
  // overwrite (a sheet already sent to the client) surfaces here. Silent when
  // there is nothing to review, so the check costs the page no space.
  const divergenceCount =
    branchId && selectedMonth
      ? (await findDivergences({ branchId, month: selectedMonth })).length
      : 0;

  return (
    <div className="space-y-5">
      {divergenceCount > 0 && (
        <Link
          href={`/invoices/client-timesheet/sync?month=${selectedMonth}`}
          className="flex items-center gap-3 rounded-card border border-[var(--warning-border)] bg-[var(--warning-soft)] px-4 py-2.5 text-sm transition hover:brightness-[0.98]"
        >
          <AlertTriangle className="h-4 w-4 shrink-0 text-[var(--warning)]" aria-hidden />
          <span className="flex-1 text-primary">
            <span className="font-medium">
              {divergenceCount} {divergenceCount === 1 ? "day differs" : "days differ"}
            </span>{" "}
            <span className="text-muted">from attendance for {monthLabelFromKey(selectedMonth!)}.</span>
          </span>
          <span className="shrink-0 text-xs font-medium text-[var(--brand-primary)]">Review →</span>
        </Link>
      )}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <PageHeader
          title="Client Timesheet"
          icon={FileSearch}
          description={<>Review and edit a month&rsquo;s day-by-day hours before invoicing.</>}
        />
        <div className="flex items-center gap-2">
          <Link
            href="/invoices/client-timesheet/daily"
            className="btn btn-secondary"
          >
            Daily Entry
          </Link>
          <Link
            href="/invoices/client-timesheet/new"
            className="btn btn-primary"
          >
            <Plus className="h-4 w-4" aria-hidden />

            New Entry
          </Link>
        </div>
      </div>

      {months.length > 0 && (
        <TimesheetFilters
          month={selectedMonth ?? ""}
          clientId={allClients ? ALL_CLIENTS : (selectedClientId ?? "")}
          project={selectedProject ?? ""}
          site={selectedSite ?? ""}
          months={months.map((m) => ({ value: m, label: monthLabelFromKey(m) }))}
          clients={[...(clients.length > 1 ? [{ value: ALL_CLIENTS, label: "All clients" }] : []), ...clients.map((c) => ({ value: c.id, label: c.name }))]}
          projects={[{ value: "", label: projectOptions.length === 0 ? "None recorded" : "All projects" }, ...projectOptions.map(([id, label]) => ({ value: id, label }))]}
          sites={[{ value: "", label: siteOptions.length === 0 ? "None recorded" : "All sites" }, ...siteOptions.map((site) => ({ value: site, label: site }))]}
        />
      )}

      {allEntries.length > 0 && projectOptions.length === 0 && siteOptions.length === 0 && (
        <p className="text-xs text-subtle">
          These rows carry no project or site, so those filters have nothing to offer
          — set them on the entries or on the workers&rsquo; records to use them here.
        </p>
      )}

      {entries.length === 0 ? (
        <div className="empty-state flex flex-col items-center gap-3 py-10">
          <p className="text-sm text-muted">
            {allEntries.length > 0
              ? "No entries match those filters — clear the project or site to see the rest."
              : "No billable timesheet entries for this client/month."}
          </p>
          {allEntries.length === 0 && (
            <div className="flex flex-wrap justify-center gap-2">
              <Link href="/invoices/client-timesheet/new" className="btn btn-primary btn-sm">New entry</Link>
              <Link href="/invoices/client-timesheet/sync" className="btn btn-secondary btn-sm">Import timesheets</Link>
            </div>
          )}
        </div>
      ) : (
        <ClientTimesheetGrid month={selectedMonth!} entries={entries} showClient={allClients} />
      )}
    </div>
  );
}
