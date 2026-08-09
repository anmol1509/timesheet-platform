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
          },
          orderBy: [{ trade: "asc" }, { employeeName: "asc" }],
        })
      : [];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Client Timesheet</h1>
          <p className="mt-1 text-sm text-slate-500">
            Review and edit a month&rsquo;s day-by-day hours before invoicing.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/invoices/client-timesheet/daily"
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
          >
            Daily Entry
          </Link>
          <Link
            href="/invoices/client-timesheet/new"
            className="rounded-lg bg-[#166534] px-4 py-2 text-sm font-medium text-white transition hover:bg-[#166534]/90"
          >
            + New Entry
          </Link>
        </div>
      </div>

      {months.length > 0 && (
        <form className="flex flex-wrap items-end gap-3 rounded-3xl border border-slate-200 bg-white p-4">
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-slate-500">Month</span>
            <select
              name="month"
              defaultValue={selectedMonth}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-slate-900"
            >
              {months.map((m) => (
                <option key={m} value={m}>
                  {monthLabelFromKey(m)}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-slate-500">Client</span>
            <select
              name="clientId"
              defaultValue={selectedClientId}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-slate-900"
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
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white"
          >
            Go
          </button>
        </form>
      )}

      {entries.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-slate-300 bg-white px-6 py-14 text-center">
          <p className="text-sm text-slate-500">
            No billable timesheet entries for this client/month.
          </p>
        </div>
      ) : (
        <ClientTimesheetGrid month={selectedMonth!} entries={entries} />
      )}
    </div>
  );
}
