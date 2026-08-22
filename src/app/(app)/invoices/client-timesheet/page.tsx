import Link from "next/link";
import { prisma } from "@/lib/db";
import { monthLabelFromKey } from "@/lib/timesheetSummary";
import { requireUserWithBranch } from "@/lib/auth";
import { branchWhere } from "@/lib/branch";
import { ClientTimesheetGrid } from "./client-timesheet-grid";

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
  const selectedClientId =
    params.clientId && clients.some((c) => c.id === params.clientId)
      ? params.clientId
      : clients[0]?.id;

  const allEntries =
    selectedMonth && selectedClientId
      ? await prisma.timesheetEntry.findMany({
          where: { month: selectedMonth, clientId: selectedClientId, ...branchWhere(branchId) },
          select: {
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
          orderBy: [{ trade: "asc" }, { employeeName: "asc" }],
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
    return { ...e, resolvedProject: project };
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

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl tracking-tight text-primary font-semibold">Client Timesheet</h1>
          <p className="mt-1 text-sm text-muted">
            Review and edit a month&rsquo;s day-by-day hours before invoicing.
          </p>
        </div>
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
            + New Entry
          </Link>
        </div>
      </div>

      {months.length > 0 && (
        <form className="card flex flex-wrap items-end gap-3 p-4">
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-muted">Month</span>
            <select
              name="month"
              defaultValue={selectedMonth}
              className="input"
            >
              {months.map((m) => (
                <option key={m} value={m}>
                  {monthLabelFromKey(m)}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-muted">Client</span>
            <select
              name="clientId"
              defaultValue={selectedClientId}
              className="input"
            >
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          {/* Always shown, even with nothing to offer. Hiding them made the
              filters look missing on a client whose rows carry no project or
              site — the control should say why it's empty, not disappear. */}
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-muted">Project</span>
            <select
              name="project"
              defaultValue={selectedProject}
              disabled={projectOptions.length === 0}
              className="input disabled:opacity-60"
            >
              <option value="">
                {projectOptions.length === 0 ? "None recorded" : "All projects"}
              </option>
              {projectOptions.map(([id, label]) => (
                <option key={id} value={id}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-muted">Site</span>
            <select
              name="site"
              defaultValue={selectedSite}
              disabled={siteOptions.length === 0}
              className="input disabled:opacity-60"
            >
              <option value="">
                {siteOptions.length === 0 ? "None recorded" : "All sites"}
              </option>
              {siteOptions.map((site) => (
                <option key={site} value={site}>
                  {site}
                </option>
              ))}
            </select>
          </label>
          <button
            type="submit"
            className="btn btn-primary"
          >
            Go
          </button>
        </form>
      )}

      {allEntries.length > 0 && projectOptions.length === 0 && siteOptions.length === 0 && (
        <p className="text-xs text-subtle">
          These rows carry no project or site, so those filters have nothing to offer
          — set them on the entries or on the workers&rsquo; records to use them here.
        </p>
      )}

      {entries.length === 0 ? (
        <div className="empty-state">
          <p className="text-sm text-muted">
            {allEntries.length > 0
              ? "No entries match those filters — clear the project or site to see the rest."
              : "No billable timesheet entries for this client/month."}
          </p>
        </div>
      ) : (
        <ClientTimesheetGrid month={selectedMonth!} entries={entries} />
      )}
    </div>
  );
}
