import Link from "next/link";
import { prisma } from "@/lib/db";
import { monthLabelFromKey } from "@/lib/timesheetSummary";

export default async function CompaniesPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const params = await searchParams;

  const monthRows = await prisma.timesheetEntry.findMany({
    distinct: ["month"],
    select: { month: true },
    orderBy: { month: "desc" },
  });
  const months = monthRows.map((m) => m.month);
  const selectedMonth = params.month && months.includes(params.month)
    ? params.month
    : months[0];

  const suppliers = selectedMonth
    ? await prisma.supplier.findMany({
        where: { entries: { some: { month: selectedMonth } } },
        include: {
          entries: {
            where: { month: selectedMonth },
          },
        },
        orderBy: { name: "asc" },
      })
    : [];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Companies</h1>
          <p className="mt-1 text-sm text-slate-500">
            Pick a month, then generate a timesheet for any company.
          </p>
        </div>
        {months.length > 0 && (
          <form className="flex items-center gap-2">
            <label htmlFor="month" className="text-sm text-slate-500">
              Month
            </label>
            <select
              id="month"
              name="month"
              defaultValue={selectedMonth}
              className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-900 outline-none focus:border-slate-900"
            >
              {months.map((m) => (
                <option key={m} value={m}>
                  {monthLabelFromKey(m)}
                </option>
              ))}
            </select>
            <NativeSubmit />
          </form>
        )}
      </div>

      {suppliers.length === 0 && (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-14 text-center">
          <p className="text-sm text-slate-500">
            No data yet.{" "}
            <Link href="/upload" className="font-medium text-slate-900 underline">
              Upload a time sheet
            </Link>{" "}
            to get started.
          </p>
        </div>
      )}

      {suppliers.length > 0 && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {suppliers.map((s) => {
            const employeeCount = s.entries.length;
            const totalHours = s.entries.reduce((sum, e) => sum + e.totalHours, 0);
            const totalAmount = s.entries.reduce((sum, e) => sum + e.invoiceValue, 0);
            return (
              <Link
                key={s.id}
                href={`/companies/${s.id}/generate?month=${selectedMonth}`}
                className="group flex flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-slate-300 hover:shadow-md"
              >
                <h2 className="text-base font-semibold text-slate-900">
                  {s.name}
                </h2>
                <p className="mt-1 text-xs text-slate-400">
                  {s.fullName || "No letterhead name set"}
                </p>
                <div className="mt-4 flex items-center gap-4 text-sm text-slate-600">
                  <span>{employeeCount} employees</span>
                  <span>{totalHours.toFixed(1)} hrs</span>
                </div>
                <div className="mt-1 text-sm font-medium text-slate-900">
                  AED {totalAmount.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                </div>
                <span className="mt-4 text-sm font-medium text-blue-600 group-hover:underline">
                  Review &amp; generate →
                </span>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

function NativeSubmit() {
  return (
    <button
      type="submit"
      className="rounded-lg bg-slate-900 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-slate-800"
    >
      Go
    </button>
  );
}
