import { Banknote } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireUserWithBranch, subjectOf } from "@/lib/auth";
import { branchWhere } from "@/lib/branch";
import { can } from "@/lib/permissions";
import { Badge, type BadgeColor } from "@/components/Badge";
import { CreateRunForm } from "./create-run-form";
import { CostTrend } from "./cost-trend";
import { isUsableBank } from "@/lib/bankStatus";
import { isPayType, payDataGap } from "@/lib/payroll";
import { ApprovalRuleForm } from "./approval-rule";

export const metadata = { title: "Payroll" };

const STATUS: Record<string, { label: string; color: BadgeColor }> = {
  DRAFT: { label: "Draft", color: "amber" },
  APPROVED: { label: "Approved", color: "blue" },
  PAID: { label: "Paid", color: "green" },
};
const aed = (n: number) => n.toLocaleString("en-AE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default async function PayrollPage() {
  const { user, branchId } = await requireUserWithBranch();
  const subject = subjectOf(user);
  const [runs, branch, companies, ownEmployees, allBanks] = await Promise.all([
    prisma.payrollRun.findMany({
      where: branchWhere(branchId),
      orderBy: { month: "desc" },
      take: 36,
      include: { lines: { select: { net: true } }, branch: { select: { code: true } }, company: { select: { name: true } } },
    }),
    branchId ? prisma.branch.findUnique({ where: { id: branchId }, include: { wpsPayerBank: true } }) : null,
    branchId ? prisma.supplier.findMany({ where: { branchId, isOwnCompany: true }, select: { id: true, name: true, payType: true, wpsEstablishmentId: true }, orderBy: { name: "asc" } }) : [],
    branchId ? prisma.employee.findMany({ where: { branchId, status: { not: "TERMINATED" }, supplier: { isOwnCompany: true } }, select: { supplierId: true, payStructure: true, basicSalary: true, flatMonthlyRate: true, hourlyRate: true } }) : [],
    branchId ? prisma.bank.findMany({ where: { branchId, status: "ACTIVE" } }) : [],
  ]);

  const now = new Date();
  const prev = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
  const defaultMonth = `${prev.getUTCFullYear()}-${String(prev.getUTCMonth() + 1).padStart(2, "0")}`;
  const usableBanks = allBanks.filter((b) => isUsableBank(b) && b.routingCode);

  // One line of setup per own company: can a run be created and, later, paid by WPS?
  const setup = companies.map((c) => {
    const type = isPayType(c.payType) ? c.payType : null;
    const emps = ownEmployees.filter((e) => e.supplierId === c.id);
    const ready = emps.filter((e) => !payDataGap(type, { payStructure: e.payStructure, basicSalary: Number(e.basicSalary ?? 0), flatMonthlyRate: Number(e.flatMonthlyRate ?? 0), hourlyRate: Number(e.hourlyRate ?? 0) })).length;
    const bank = usableBanks.find((b) => b.companyId === c.id) ?? (branch?.wpsPayerBank && isUsableBank(branch.wpsPayerBank) && branch.wpsPayerBank.routingCode ? branch.wpsPayerBank : null);
    return { c, type, total: emps.length, ready, establishment: c.wpsEstablishmentId ?? branch?.wpsEstablishmentId ?? null, bank };
  });

  return (
    <div className="space-y-5">
      <PageHeader
        title="Payroll"
        icon={Banknote}
        description={<>Monthly payroll runs: one run per own company. Basic pay comes from attendance, hourly pay from approved timesheet hours. Review, submit for approval, then download the WPS file for your bank.</>}
      />

      {branchId && setup.length > 0 && (
        <section className="card overflow-x-auto">
          <div className="border-b border-default px-5 py-3"><h2 className="text-sm font-semibold text-primary">Companies</h2></div>
          <table className="w-full text-sm">
            <thead className="text-left text-xs font-medium uppercase tracking-wide text-muted"><tr><th className="px-5 py-2">Company</th><th className="px-3 py-2">Pay type</th><th className="px-3 py-2 text-right">Ready to pay</th><th className="px-3 py-2">MOHRE ID</th><th className="px-3 py-2">Payer bank</th></tr></thead>
            <tbody className="divide-y divide-[var(--border)]">
              {setup.map(({ c, type, total, ready, establishment, bank }) => (
                <tr key={c.id}>
                  <td className="px-5 py-2.5"><Link href={`/suppliers/${c.id}`} className="font-medium text-primary hover:underline">{c.name}</Link></td>
                  <td className="px-3 py-2.5">{type ? <Badge color="blue">{type === "HOURLY" ? "Hourly" : "Basic"}</Badge> : <Link href={`/suppliers/${c.id}`} className="text-xs font-medium text-[var(--warning)] hover:underline">Set pay type →</Link>}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{type ? <span className={ready < total ? "text-[var(--warning)]" : "text-secondary"}>{ready} of {total}</span> : <span className="text-subtle">—</span>}</td>
                  <td className="px-3 py-2.5">{establishment ? <span className="text-secondary">{establishment}</span> : <Link href={`/suppliers/${c.id}`} className="text-xs font-medium text-[var(--warning)] hover:underline">Add →</Link>}</td>
                  <td className="px-3 py-2.5">{bank ? <span className="text-secondary">{bank.accountName}</span> : <Link href="/banks" className="text-xs font-medium text-[var(--warning)] hover:underline">Add an active bank →</Link>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {branchId ? (can(subject, "payroll", "create") && <CreateRunForm defaultMonth={defaultMonth} companies={companies.map((c) => ({ id: c.id, name: c.name, payType: c.payType }))} />) : (
        <p className="text-sm text-muted">Pick a branch from the switcher to create a payroll run.</p>
      )}

      {branchId && can(subject, "payroll", "approve") && (
        <ApprovalRuleForm current={branch?.payrollApprovalThreshold ? Number(branch.payrollApprovalThreshold) : null} />
      )}

      {runs.length >= 2 && <CostTrend runs={runs.map((r) => ({ month: r.month, total: r.lines.reduce((s, l) => s + Number(l.net), 0), headcount: r.lines.length }))} />}

      {runs.length === 0 ? (
        <div className="card p-10 text-center text-sm text-muted">No payroll runs yet.</div>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-default bg-surface-subtle text-left text-xs font-medium uppercase tracking-wide text-muted">
              <tr>
                <th className="px-4 py-3">Month</th>
                <th className="px-4 py-3">Company</th>
                {!branchId && <th className="px-4 py-3">Branch</th>}
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Employees</th>
                <th className="px-4 py-3 text-right">Total net (AED)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {runs.map((r) => (
                <tr key={r.id} className="hover:bg-surface-hover">
                  <td className="px-4 py-3 font-medium"><Link href={`/payroll/${r.id}`} className="text-primary hover:underline">{r.month}</Link></td>
                  <td className="px-4 py-3 text-secondary">{r.company?.name ?? <span className="text-subtle">All own companies</span>}{r.payType && <span className="ml-2 text-xs text-muted">{r.payType === "HOURLY" ? "hourly" : "basic"}</span>}</td>
                  {!branchId && <td className="px-4 py-3 text-secondary">{r.branch.code}</td>}
                  <td className="px-4 py-3"><Badge color={STATUS[r.status]?.color ?? "slate"} dot>{STATUS[r.status]?.label ?? r.status}</Badge></td>
                  <td className="px-4 py-3 text-right tabular-nums text-secondary">{r.lines.length}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-primary">{aed(r.lines.reduce((s, l) => s + Number(l.net), 0))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
