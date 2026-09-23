import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireUserWithBranch } from "@/lib/auth";
import { branchWhere } from "@/lib/branch";
import { daysInYear } from "@/lib/leave";

export const metadata = { title: "Leave balances" };

export default async function LeaveBalancesPage({ searchParams }: { searchParams: Promise<{ year?: string }> }) {
  const { branchId } = await requireUserWithBranch();
  const thisYear = new Date().getUTCFullYear();
  const parsed = Number((await searchParams).year);
  const year = Number.isInteger(parsed) && parsed > 2000 && parsed < 2100 ? parsed : thisYear;

  const [types, requests] = await Promise.all([
    prisma.leaveType.findMany({ where: { ...branchWhere(branchId), isActive: true }, orderBy: { name: "asc" } }),
    prisma.leaveRequest.findMany({
      where: {
        ...branchWhere(branchId),
        status: { in: ["APPROVED", "PENDING"] },
        startDate: { lte: new Date(Date.UTC(year, 11, 31)) },
        endDate: { gte: new Date(Date.UTC(year, 0, 1)) },
      },
      include: { employee: { select: { name: true, employeeIdNo: true } } },
    }),
  ]);

  // employeeId -> typeId -> { used, pending }
  const table = new Map<string, { name: string; idNo: string; byType: Map<string, { used: number; pending: number }> }>();
  for (const r of requests) {
    const n = daysInYear(r.startDate, r.endDate, year);
    if (n === 0) continue;
    const row = table.get(r.employeeId) ?? { name: r.employee.name, idNo: r.employee.employeeIdNo, byType: new Map() };
    const cell = row.byType.get(r.leaveTypeId) ?? { used: 0, pending: 0 };
    if (r.status === "APPROVED") cell.used += n;
    else cell.pending += n;
    row.byType.set(r.leaveTypeId, cell);
    table.set(r.employeeId, row);
  }
  const rows = [...table.entries()].sort((a, b) => a[1].name.localeCompare(b[1].name));

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-primary">Leave balances</h1>
          <p className="mt-1 text-sm text-muted">Days taken against each entitlement in {year}. Only employees with leave that year appear.</p>
        </div>
        <div className="flex gap-1.5">
          {[year - 1, year, year + 1].map((y) => (
            <Link key={y} href={`/leave/balances?year=${y}`} className={y === year ? "rounded-md bg-brand-soft px-3 py-1.5 text-sm font-medium text-[var(--brand-primary)]" : "rounded-md px-3 py-1.5 text-sm text-secondary hover:bg-surface-hover"}>
              {y}
            </Link>
          ))}
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="card p-10 text-center text-sm text-muted">No approved or pending leave in {year}.</div>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-default bg-surface-subtle text-left text-xs font-medium uppercase tracking-wide text-muted">
              <tr>
                <th className="px-4 py-3">Employee</th>
                {types.map((t) => (
                  <th key={t.id} className="px-4 py-3 text-right">
                    {t.name}
                    <span className="block font-normal normal-case">{t.daysPerYear > 0 ? `of ${t.daysPerYear}` : "uncapped"}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {rows.map(([id, row]) => (
                <tr key={id}>
                  <td className="px-4 py-3">
                    <p className="font-medium text-primary">{row.name}</p>
                    <p className="text-xs text-muted">{row.idNo}</p>
                  </td>
                  {types.map((t) => {
                    const c = row.byType.get(t.id);
                    if (!c) return <td key={t.id} className="px-4 py-3 text-right text-subtle">—</td>;
                    const over = t.daysPerYear > 0 && c.used > t.daysPerYear;
                    return (
                      <td key={t.id} className="px-4 py-3 text-right tabular-nums">
                        <span className={over ? "font-medium text-[var(--error)]" : "text-primary"}>{c.used}</span>
                        {t.daysPerYear > 0 && <span className="text-muted"> · {Math.max(0, t.daysPerYear - c.used)} left</span>}
                        {c.pending > 0 && <span className="block text-xs text-muted">+{c.pending} pending</span>}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
