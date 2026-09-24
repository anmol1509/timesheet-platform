import Link from "next/link";
import { CheckCircle2, CircleAlert } from "lucide-react";
import { prisma } from "@/lib/db";
import { requireUserWithBranch, subjectOf } from "@/lib/auth";
import { branchWhere } from "@/lib/branch";
import { can } from "@/lib/permissions";
import { Badge, type BadgeColor } from "@/components/Badge";
import { CreateRunForm } from "./create-run-form";
import { CostTrend } from "./cost-trend";
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
  const [runs, branch, active, withPay] = await Promise.all([
    prisma.payrollRun.findMany({
      where: branchWhere(branchId),
      orderBy: { month: "desc" },
      take: 36,
      include: { lines: { select: { net: true } }, branch: { select: { code: true } } },
    }),
    branchId ? prisma.branch.findUnique({ where: { id: branchId }, include: { wpsPayerBank: true } }) : null,
    prisma.employee.count({ where: { ...branchWhere(branchId), status: { not: "TERMINATED" } } }),
    prisma.employee.count({ where: { ...branchWhere(branchId), status: { not: "TERMINATED" }, payStructure: { not: null } } }),
  ]);

  const now = new Date();
  const prev = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
  const defaultMonth = `${prev.getUTCFullYear()}-${String(prev.getUTCMonth() + 1).padStart(2, "0")}`;
  const bank = branch?.wpsPayerBank;
  const checks = [
    { ok: withPay > 0, text: `${withPay} of ${active} active employees have a pay structure`, fix: "Set it on each employee's Payroll & WPS tab.", href: "/employees" },
    { ok: !!branch?.wpsEstablishmentId, text: "MOHRE establishment ID", fix: "Add it under Company profile → Payroll / WPS.", href: "/settings/company" },
    { ok: !!bank && !!bank.routingCode && !!(bank.ibanNo || bank.accountNo), text: "Salary payer bank account (with routing code and IBAN)", fix: "Choose it under Company profile → Payroll / WPS; add the account under Banks.", href: "/settings/company" },
  ];

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-primary">Payroll</h1>
        <p className="mt-1 text-sm text-muted">Monthly payroll runs: calculate pay from attendance, review, approve, then download the WPS file for your bank.</p>
      </div>

      {branchId && (
        <section className="card p-4">
          <h2 className="mb-2 text-sm font-semibold text-primary">Setup checklist</h2>
          <ul className="space-y-1.5 text-sm">
            {checks.map((c) => (
              <li key={c.text} className="flex items-start gap-2">
                {c.ok ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[var(--success)]" aria-hidden /> : <CircleAlert className="mt-0.5 h-4 w-4 shrink-0 text-[var(--warning)]" aria-hidden />}
                <span className={c.ok ? "text-secondary" : "text-primary"}>
                  {c.text}
                  {!c.ok && <> — <Link href={c.href} className="text-[var(--brand-primary)] hover:underline">{c.fix}</Link></>}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {branchId ? (can(subject, "payroll", "create") && <CreateRunForm defaultMonth={defaultMonth} />) : (
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
