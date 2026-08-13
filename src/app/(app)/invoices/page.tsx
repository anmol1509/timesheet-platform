import Link from "next/link";
import { prisma } from "@/lib/db";
import { monthLabelFromKey } from "@/lib/timesheetSummary";
import { requireUserWithBranch } from "@/lib/auth";
import { branchWhere } from "@/lib/branch";
import { InvoiceGrid } from "./invoice-grid";

export default async function InvoicesPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
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
  const selectedMonth = params.month && months.includes(params.month)
    ? params.month
    : months[0];

  const clients = selectedMonth
    ? await prisma.client.findMany({
        where: {
          entries: { some: { month: selectedMonth, status: "CLIENT_APPROVED" } },
          ...branchWhere(branchId),
        },
        include: {
          entries: { where: { month: selectedMonth, status: "CLIENT_APPROVED" } },
          tradeRates: true,
        },
        orderBy: { name: "asc" },
      })
    : [];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Invoices</h1>
          <p className="mt-1 text-sm text-slate-500">
            Pick a month, then review and generate a client invoice.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {months.length > 0 && (
            <form className="flex items-center gap-2">
              <label htmlFor="month" className="text-sm text-slate-500">
                Month
              </label>
              <select
                id="month"
                name="month"
                defaultValue={selectedMonth}
                className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-900 outline-none focus:border-[var(--brand-primary)]"
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
          <Link
            href="/invoices/history"
            className="text-sm font-medium text-blue-600 hover:underline"
          >
            History →
          </Link>
        </div>
      </div>

      {clients.length === 0 && (
        <div className="rounded-3xl border border-dashed border-slate-300 bg-white px-6 py-14 text-center">
          <p className="text-sm text-slate-500">
            No billable timesheet entries yet. Entries need a client assigned
            during upload or manual entry to appear here.
          </p>
        </div>
      )}

      {clients.length > 0 && (
        <InvoiceGrid
          month={selectedMonth!}
          clients={clients.map((c) => {
            const tradeRateMap = Object.fromEntries(
              c.tradeRates.map((r) => [r.trade, r.rate])
            );
            const fallbackRate = c.hourlyRate ?? c.basicRate ?? null;
            const totalHours = c.entries.reduce((sum, e) => sum + e.totalHours, 0);
            const cost = c.entries.reduce((sum, e) => sum + e.totalHours * e.rate, 0);
            let amount = 0;
            const unratedTrades = new Set<string>();
            for (const e of c.entries) {
              const rate = tradeRateMap[e.trade] ?? fallbackRate;
              if (rate == null) unratedTrades.add(e.trade);
              amount += e.totalHours * (rate ?? 0);
            }
            return {
              id: c.id,
              name: c.name,
              employeeCount: c.entries.length,
              totalHours,
              billRateSet: unratedTrades.size === 0,
              unratedTrades: [...unratedTrades],
              amount,
              margin: amount - cost,
            };
          })}
        />
      )}
    </div>
  );
}

function NativeSubmit() {
  return (
    <button
      type="submit"
      className="rounded-lg bg-[var(--brand-primary)] px-3 py-1.5 text-sm font-medium text-white transition hover:bg-[var(--brand-primary-hover)]"
    >
      Go
    </button>
  );
}
