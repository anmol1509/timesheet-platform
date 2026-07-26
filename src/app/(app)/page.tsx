import Link from "next/link";
import { prisma } from "@/lib/db";

function formatMonthLabel(month: string) {
  const [y, m] = month.split("-");
  const date = new Date(Number(y), Number(m) - 1, 1);
  return date.toLocaleDateString("en-GB", { month: "long", year: "numeric" });
}

export default async function DashboardPage() {
  const [supplierCount, latestUpload, months, entryCount] = await Promise.all([
    prisma.supplier.count(),
    prisma.upload.findFirst({
      orderBy: { uploadedAt: "desc" },
      include: { uploadedBy: true, months: true },
    }),
    prisma.timesheetEntry.findMany({
      distinct: ["month"],
      select: { month: true },
      orderBy: { month: "desc" },
    }),
    prisma.timesheetEntry.count(),
  ]);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Dashboard</h1>
        <p className="mt-1 text-sm text-slate-500">
          Overview of your uploaded timesheets and companies.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Companies" value={String(supplierCount)} />
        <StatCard label="Employee-month records" value={String(entryCount)} />
        <StatCard
          label="Last upload"
          value={
            latestUpload
              ? new Date(latestUpload.uploadedAt).toLocaleString("en-GB", {
                  day: "2-digit",
                  month: "short",
                  hour: "2-digit",
                  minute: "2-digit",
                })
              : "—"
          }
          sub={latestUpload ? `by ${latestUpload.uploadedBy.name}` : "No uploads yet"}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Link
          href="/upload"
          className="group rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:border-slate-300 hover:shadow-md"
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
            ↑
          </div>
          <h2 className="mt-4 text-base font-semibold text-slate-900">
            Upload a timesheet
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Import today&apos;s consolidated time sheet. Existing entries for the
            month are updated automatically.
          </p>
        </Link>
        <Link
          href="/companies"
          className="group rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:border-slate-300 hover:shadow-md"
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
            ⬇
          </div>
          <h2 className="mt-4 text-base font-semibold text-slate-900">
            Generate company sheets
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Review hours and deductions, then export a PDF or XLSX timesheet
            per company.
          </p>
        </Link>
      </div>

      {months.length > 0 && (
        <div>
          <h2 className="mb-3 text-sm font-semibold text-slate-900">
            Months with data
          </h2>
          <div className="flex flex-wrap gap-2">
            {months.map((m) => (
              <span
                key={m.month}
                className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-600"
              >
                {formatMonthLabel(m.month)}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
        {label}
      </p>
      <p className="mt-2 text-2xl font-semibold text-slate-900">{value}</p>
      {sub && <p className="mt-1 text-xs text-slate-400">{sub}</p>}
    </div>
  );
}
