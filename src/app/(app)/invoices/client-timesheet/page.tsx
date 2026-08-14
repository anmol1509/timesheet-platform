import Link from "next/link";
import { prisma } from "@/lib/db";
import { monthLabelFromKey } from "@/lib/timesheetSummary";
import { requireUserWithBranch } from "@/lib/auth";
import { branchWhere } from "@/lib/branch";
import { ClientTimesheetGrid } from "./client-timesheet-grid";

export default async function ClientTimesheetPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string; clientId?: string }>;
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

  const entries =
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
          },
          orderBy: [{ trade: "asc" }, { employeeName: "asc" }],
        })
      : [];

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
          <button
            type="submit"
            className="btn btn-primary"
          >
            Go
          </button>
        </form>
      )}

      {entries.length === 0 ? (
        <div className="empty-state">
          <p className="text-sm text-muted">
            No billable timesheet entries for this client/month.
          </p>
        </div>
      ) : (
        <ClientTimesheetGrid month={selectedMonth!} entries={entries} />
      )}
    </div>
  );
}
