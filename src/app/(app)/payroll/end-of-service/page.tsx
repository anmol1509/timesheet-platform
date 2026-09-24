import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireUserWithBranch } from "@/lib/auth";
import { branchWhere } from "@/lib/branch";
import { PageHeader } from "@/components/PageHeader";
import { gratuity, yearsOfService } from "@/lib/gratuity";
import { round2 } from "@/lib/payroll";

export const metadata = { title: "End of service" };

const aed = (n: number) => n.toLocaleString("en-AE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/**
 * Accrued end-of-service gratuity per employee, as of today. A liability
 * report, not a settlement — see lib/gratuity.ts for what it does and does not
 * model.
 */
export default async function EndOfServicePage() {
  const { branchId } = await requireUserWithBranch();
  const employees = await prisma.employee.findMany({
    where: { ...branchWhere(branchId), status: { not: "TERMINATED" }, payStructure: { not: null } },
    select: { id: true, name: true, employeeIdNo: true, joinDate: true, payStructure: true, basicSalary: true, flatMonthlyRate: true },
    orderBy: { name: "asc" },
  });

  const now = new Date();
  const rows = employees.map((e) => {
    // Gratuity is on the basic wage; for a flat rate the flat rate stands in as
    // the basic, the same convention payroll uses for overtime. Hourly workers
    // have no monthly basic, so they are listed without a figure.
    const basic = e.payStructure === "FLAT" ? Number(e.flatMonthlyRate ?? 0) : e.payStructure === "ITEMISED" ? Number(e.basicSalary ?? 0) : 0;
    const years = e.joinDate ? yearsOfService(e.joinDate, now) : null;
    return { ...e, basic, years, amount: years == null ? null : gratuity(basic, years) };
  });
  const total = round2(rows.reduce((s, r) => s + (r.amount ?? 0), 0));
  const missingJoin = rows.filter((r) => r.years == null).length;
  const hourly = rows.filter((r) => r.payStructure === "HOURLY").length;

  return (
    <div className="space-y-5">
      <PageHeader
        title="End of service"
        description="Gratuity accrued to date under UAE labour law: 21 days' basic per year for the first 5 years, 30 days after, capped at 2 years' basic. Nothing is due before 1 year of service."
      />
      <div className="card flex flex-wrap items-baseline gap-x-6 gap-y-1 p-4">
        <div><p className="text-xs text-muted">Accrued liability</p><p className="tabular text-2xl font-semibold text-primary">AED {aed(total)}</p></div>
        <p className="text-xs text-subtle">
          Estimate on unlimited-term contracts. Excludes resignation reductions and contract-specific terms.
          {missingJoin > 0 && ` ${missingJoin} employee${missingJoin === 1 ? " has" : "s have"} no join date, so no figure.`}
          {hourly > 0 && ` ${hourly} hourly-paid ${hourly === 1 ? "worker has" : "workers have"} no monthly basic, so no figure.`}
        </p>
      </div>

      {rows.length === 0 ? (
        <div className="empty-state"><p className="text-sm text-muted">No employees with a pay structure yet.</p></div>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-default bg-surface-subtle text-left text-xs font-medium uppercase tracking-wide text-muted">
              <tr>
                <th className="px-4 py-3">Employee</th>
                <th className="px-4 py-3">Joined</th>
                <th className="px-4 py-3 text-right">Service</th>
                <th className="px-4 py-3 text-right">Monthly basic</th>
                <th className="px-4 py-3 text-right">Gratuity accrued</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className="px-4 py-3"><Link href={`/employees/${r.id}`} className="font-medium text-primary hover:underline">{r.name}</Link><p className="text-xs text-muted">{r.employeeIdNo}</p></td>
                  <td className="px-4 py-3 text-secondary">{r.joinDate ? r.joinDate.toLocaleDateString("en-GB") : <span className="text-subtle">Not set</span>}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-secondary">{r.years == null ? "—" : `${r.years.toFixed(1)} yrs`}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-secondary">{r.basic > 0 ? aed(r.basic) : "—"}</td>
                  <td className="px-4 py-3 text-right font-medium tabular-nums text-primary">{r.amount == null || r.basic <= 0 ? "—" : aed(r.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
