import Link from "next/link";
import { prisma } from "@/lib/db";
import { monthLabelFromKey } from "@/lib/timesheetSummary";
import { CompanyGrid } from "./company-grid";
import { Select } from "@/components/ui/Select";

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
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-xl tracking-tight text-primary font-semibold">Companies</h1>
          <p className="mt-1 text-sm text-muted">
            Pick a month, then generate a timesheet for any company.
          </p>
        </div>
        {months.length > 0 && (
          <form className="flex items-center gap-2">
            <label htmlFor="month" className="text-sm text-muted">
              Month
            </label>
            <Select name="month" defaultValue={selectedMonth} options={[...months.map((m) => ({ value: m, label: monthLabelFromKey(m) }))]} />
            <NativeSubmit />
          </form>
        )}
      </div>

      {suppliers.length === 0 && (
        <div className="empty-state">
          <p className="text-sm text-muted">
            No data yet.{" "}
            <Link href="/upload" className="font-medium text-primary underline">
              Upload a time sheet
            </Link>{" "}
            to get started.
          </p>
        </div>
      )}

      {suppliers.length > 0 && (
        <CompanyGrid
          month={selectedMonth!}
          companies={suppliers.map((s) => ({
            id: s.id,
            name: s.name,
            fullName: s.fullName,
            employeeCount: s.entries.length,
            totalHours: s.entries.reduce((sum, e) => sum + e.totalHours, 0),
            totalAmount: s.entries.reduce((sum, e) => sum + e.invoiceValue, 0),
            invoiceApproved: s.invoiceApprovalStatus === "Approved",
          }))}
        />
      )}
    </div>
  );
}

function NativeSubmit() {
  return (
    <button
      type="submit"
      className="btn btn-primary btn-sm"
    >
      Go
    </button>
  );
}
