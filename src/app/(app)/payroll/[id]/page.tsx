import Link from "next/link";
import { notFound } from "next/navigation";
import { CircleAlert } from "lucide-react";
import { prisma } from "@/lib/db";
import { requireUserWithBranch, subjectOf } from "@/lib/auth";
import { branchWhere, isOutsideBranch } from "@/lib/branch";
import { can } from "@/lib/permissions";
import { isCashMode, wpsGaps } from "@/lib/payroll";
import { Badge, type BadgeColor } from "@/components/Badge";
import { AdjustmentCell, RunControls } from "./run-controls";

const STATUS: Record<string, { label: string; color: BadgeColor }> = {
  DRAFT: { label: "Draft", color: "amber" },
  APPROVED: { label: "Approved", color: "blue" },
  PAID: { label: "Paid", color: "green" },
};
const aed = (n: number) => n.toLocaleString("en-AE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default async function PayrollRunPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { user, branchId, isSuperAdmin } = await requireUserWithBranch();
  const subject = subjectOf(user);

  const run = await prisma.payrollRun.findUnique({
    where: { id },
    include: {
      branch: { select: { code: true, name: true } },
      createdBy: { select: { name: true } },
      approvedBy: { select: { name: true } },
      lines: { include: { employee: { select: { id: true, name: true, employeeIdNo: true } } }, orderBy: { employee: { name: "asc" } } },
    },
  });
  if (!run || isOutsideBranch(run.branchId, branchId, isSuperAdmin)) notFound();

  const unpaidSetup = await prisma.employee.count({
    where: { ...branchWhere(run.branchId), status: { not: "TERMINATED" }, payStructure: null },
  });

  const n = (d: { toString(): string }) => Number(d.toString());
  const total = run.lines.reduce((s, l) => s + n(l.net), 0);
  const cashCount = run.lines.filter((l) => isCashMode(l.paymentMode)).length;
  const gapRows = run.lines.map((l) => ({ l, gaps: wpsGaps(l) })).filter((x) => x.gaps.length > 0);
  const draft = run.status === "DRAFT";

  return (
    <div className="space-y-5">
      <div>
        <Link href="/payroll" className="text-xs text-muted hover:text-secondary">← Payroll</Link>
        <div className="mt-1 flex flex-wrap items-center gap-3">
          <h1 className="text-xl font-semibold tracking-tight text-primary">Payroll — {run.month}</h1>
          <Badge color={STATUS[run.status]?.color ?? "slate"} dot>{STATUS[run.status]?.label ?? run.status}</Badge>
        </div>
        <p className="mt-1 text-sm text-muted">
          {run.branch.name} · created by {run.createdBy.name}
          {run.approvedBy && ` · approved by ${run.approvedBy.name}`}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="card p-4"><p className="text-xs uppercase tracking-wide text-muted">Total net pay</p><p className="mt-1 text-2xl font-semibold tabular-nums text-primary">AED {aed(total)}</p></div>
        <div className="card p-4"><p className="text-xs uppercase tracking-wide text-muted">Employees</p><p className="mt-1 text-2xl font-semibold tabular-nums text-primary">{run.lines.length}</p>{cashCount > 0 && <p className="text-xs text-muted">{cashCount} paid in cash (not in WPS file)</p>}</div>
        <div className="card p-4"><p className="text-xs uppercase tracking-wide text-muted">Without pay structure</p><p className="mt-1 text-2xl font-semibold tabular-nums text-primary">{unpaidSetup}</p><p className="text-xs text-muted">Not in this run</p></div>
      </div>

      <RunControls
        id={run.id}
        status={run.status}
        canEdit={can(subject, "payroll", "edit")}
        canApprove={can(subject, "payroll", "approve")}
        canExport={can(subject, "payroll", "export")}
        canDelete={can(subject, "payroll", "delete")}
      />

      {draft && gapRows.length > 0 && (
        <div className="card flex gap-3 border-[var(--warning-border)] bg-[var(--warning-soft)] p-4 text-sm">
          <CircleAlert className="mt-0.5 h-4 w-4 shrink-0 text-[var(--warning)]" aria-hidden />
          <div>
            <p className="font-medium text-primary">{gapRows.length} employee{gapRows.length === 1 ? "" : "s"} can&apos;t be approved until bank details are complete</p>
            <ul className="mt-1 space-y-0.5 text-secondary">
              {gapRows.slice(0, 8).map(({ l, gaps }) => (
                <li key={l.id}>
                  <Link href={`/employees/${l.employee.id}`} className="text-[var(--brand-primary)] hover:underline">{l.employee.name}</Link> — missing {gaps.join(", ")}
                </li>
              ))}
            </ul>
            <p className="mt-1 text-xs text-muted">Fix them on the employee&apos;s Payroll &amp; WPS tab, then Recalculate. (Set the payment mode to Cash for anyone not paid through the bank.)</p>
          </div>
        </div>
      )}

      {run.lines.length === 0 ? (
        <div className="card p-10 text-center text-sm text-muted">No employees have a pay structure yet. Set one on each employee&apos;s Payroll &amp; WPS tab, then Recalculate.</div>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-default bg-surface-subtle text-left text-xs font-medium uppercase tracking-wide text-muted">
              <tr>
                <th className="px-3 py-3">Employee</th>
                <th className="px-3 py-3 text-right">Base</th>
                <th className="px-3 py-3 text-right">Allow.</th>
                <th className="px-3 py-3 text-right">Absent</th>
                <th className="px-3 py-3 text-right">OT hrs</th>
                <th className="px-3 py-3 text-right">OT pay</th>
                <th className="px-3 py-3 text-right">Deduct.</th>
                <th className="px-3 py-3">Adjustment</th>
                <th className="px-3 py-3 text-right">Net</th>
                <th className="px-3 py-3">Bank</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {run.lines.map((l) => {
                const gaps = wpsGaps(l);
                return (
                  <tr key={l.id} className="align-top">
                    <td className="px-3 py-3">
                      <Link href={`/employees/${l.employee.id}`} className="font-medium text-primary hover:underline">{l.employee.name}</Link>
                      <p className="text-xs text-muted">{l.employee.employeeIdNo} · {l.payStructure === "FLAT" ? "Flat" : l.payStructure === "HOURLY" ? "Hourly" : "Itemised"}</p>
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums text-secondary">{aed(n(l.basic))}</td>
                    <td className="px-3 py-3 text-right tabular-nums text-secondary">{aed(n(l.allowances))}</td>
                    <td className="px-3 py-3 text-right tabular-nums text-secondary">{l.absentDays}</td>
                    <td className="px-3 py-3 text-right tabular-nums text-secondary">{l.otHours}</td>
                    <td className="px-3 py-3 text-right tabular-nums text-secondary">{aed(n(l.overtimePay))}</td>
                    <td className="px-3 py-3 text-right tabular-nums text-secondary">{n(l.deductions) > 0 ? `−${aed(n(l.deductions))}` : "—"}</td>
                    <td className="px-3 py-3">
                      <AdjustmentCell lineId={l.id} adjustment={n(l.adjustment)} note={l.adjustmentNote ?? ""} disabled={!draft || !can(subject, "payroll", "edit")} />
                    </td>
                    <td className="px-3 py-3 text-right font-medium tabular-nums text-primary">{aed(n(l.net))}</td>
                    <td className="px-3 py-3">
                      {isCashMode(l.paymentMode) ? <Badge color="slate">Cash</Badge> : gaps.length === 0 ? <Badge color="green">Ready</Badge> : <Badge color="amber">Incomplete</Badge>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <p className="text-xs text-muted">
        Rules: for monthly-paid staff, absence deduction = (base + allowances) ÷ 30 per day marked Absent in attendance. Overtime = OT hours × (base ÷ 240) × the employee&apos;s multiplier. Hourly workers are paid normal hours × their rate, with overtime at rate × multiplier. Adjustments are added to net pay (use a negative amount to deduct).
      </p>
    </div>
  );
}
