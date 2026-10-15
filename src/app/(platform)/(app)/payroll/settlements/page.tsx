import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireUserWithBranch, subjectOf } from "@/lib/auth";
import { branchWhere } from "@/lib/branch";
import { can } from "@/lib/permissions";
import { PageHeader } from "@/components/PageHeader";
import { Badge, type BadgeColor } from "@/components/Badge";
import { NewSettlementForm } from "./new-form";

export const metadata = { title: "Final settlements" };

const STATUS: Record<string, { label: string; color: BadgeColor }> = {
  DRAFT: { label: "Draft", color: "amber" },
  APPROVED: { label: "Approved", color: "blue" },
  PAID: { label: "Paid", color: "green" },
};
const aed = (n: number) => n.toLocaleString("en-AE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default async function SettlementsPage() {
  const { user, branchId } = await requireUserWithBranch();
  const subject = subjectOf(user);
  const [rows, people] = await Promise.all([
    prisma.finalSettlement.findMany({ where: branchWhere(branchId), orderBy: { createdAt: "desc" }, take: 200, include: { employee: { select: { name: true, employeeIdNo: true } } } }),
    branchId
      ? prisma.employee.findMany({
          where: { branchId, supplier: { isOwnCompany: true } },
          select: { id: true, name: true, employeeIdNo: true, exitDate: true, active: true },
          orderBy: { name: "asc" },
          take: 3000,
        })
      : [],
  ]);
  const open = new Set(rows.filter((r) => r.status !== "PAID").map((r) => r.employeeId));
  const pending = rows.filter((r) => r.status !== "PAID").reduce((s, r) => s + Number(r.net), 0);

  return (
    <div className="space-y-5">
      <PageHeader title="Final settlements" description="What a leaver is owed or owes on their last day: gratuity, days worked that no payroll run covers, leave and notice pay, less loans and other dues." />
      {branchId && can(subject, "payroll.payroll", "create") && (
        <NewSettlementForm employees={people.filter((p) => !open.has(p.id)).map((p) => ({ id: p.id, label: `${p.name} (${p.employeeIdNo})${p.active ? "" : " · inactive"}`, exitDate: p.exitDate ? p.exitDate.toISOString().slice(0, 10) : "" }))} />
      )}
      {rows.length > 0 && <p className="text-sm text-muted"><span className="tabular font-semibold text-primary">AED {aed(pending)}</span> in settlements not yet paid.</p>}
      {rows.length === 0 ? (
        <div className="card p-10 text-center text-sm text-muted">No settlements yet.</div>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-default bg-surface-subtle text-left text-xs font-medium uppercase tracking-wide text-muted">
              <tr><th className="px-4 py-3">Employee</th><th className="px-4 py-3">Last day</th><th className="px-4 py-3">Reason</th><th className="px-4 py-3">Status</th><th className="px-4 py-3 text-right">Net payable (AED)</th></tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {rows.map((r) => (
                <tr key={r.id} className="hover:bg-surface-hover">
                  <td className="px-4 py-3"><Link href={`/payroll/settlements/${r.id}`} className="font-medium text-primary hover:underline">{r.employee.name}</Link><p className="text-xs text-muted">{r.employee.employeeIdNo}</p></td>
                  <td className="px-4 py-3 text-secondary">{r.exitDate.toLocaleDateString("en-GB", { timeZone: "UTC" })}</td>
                  <td className="px-4 py-3 text-secondary">{r.reason ?? "—"}</td>
                  <td className="px-4 py-3"><Badge color={STATUS[r.status]?.color ?? "slate"} dot>{STATUS[r.status]?.label ?? r.status}</Badge></td>
                  <td className={`px-4 py-3 text-right tabular-nums ${Number(r.net) < 0 ? "text-[var(--error)]" : "text-primary"}`}>{aed(Number(r.net))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
