import Link from "next/link";
import { notFound } from "next/navigation";
import { CircleAlert, History as HistoryIcon } from "lucide-react";
import { prisma } from "@/lib/db";
import { requireUserWithBranch, subjectOf } from "@/lib/auth";
import { isOutsideBranch } from "@/lib/branch";
import { can } from "@/lib/permissions";
import { isCashMode, wpsGaps } from "@/lib/payroll";
import { runReadiness, runSkipped } from "@/lib/payrollRun";
import { Badge, type BadgeColor } from "@/components/Badge";
import { LineEditor, RunControls } from "./run-controls";
import { PaymentCell } from "./payment-cell";
import { RunStepper, RunVariance, type VarianceRow } from "./run-insights";

function previousMonth(month: string) {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 2, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

const STATUS: Record<string, { label: string; color: BadgeColor }> = {
  DRAFT: { label: "Draft", color: "amber" },
  APPROVED: { label: "Approved", color: "blue" },
  PAID: { label: "Paid", color: "green" },
};
const EVENT_LABEL: Record<string, string> = { CREATED: "Created", RECALCULATED: "Recalculated", SUBMITTED: "Sent for approval", RETURNED: "Sent back", APPROVED: "Approved", REOPENED: "Reopened", PAID: "Marked paid" };
const aed = (n: number) => n.toLocaleString("en-AE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default async function PayrollRunPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { user, branchId, isSuperAdmin } = await requireUserWithBranch();
  const subject = subjectOf(user);

  const run = await prisma.payrollRun.findUnique({
    where: { id },
    include: {
      branch: { select: { code: true, name: true, payrollApprovalThreshold: true } },
      company: { select: { name: true } },
      createdBy: { select: { name: true } },
      approvedBy: { select: { name: true } },
      events: { orderBy: { at: "desc" }, take: 30 },
      lines: { include: { employee: { select: { id: true, name: true, employeeIdNo: true } } }, orderBy: { employee: { name: "asc" } } },
    },
  });
  if (!run || isOutsideBranch(run.branchId, branchId, isSuperAdmin)) notFound();

  // Employees of this company who are not in the run because they lack the pay details its type needs.
  const skipped = await runSkipped(run);
  const unpaidSetup = skipped.length;
  const isHourly = run.payType === "HOURLY";

  const issues = run.status === "DRAFT" ? await runReadiness(run) : [];
  const projectIds = [...new Set(run.lines.map((l) => l.projectId).filter((x): x is string => !!x))];
  const projects = projectIds.length
    ? await prisma.project.findMany({ where: { id: { in: projectIds } }, select: { id: true, code: true, name: true } })
    : [];
  const projectLabel = new Map(projects.map((p) => [p.id, `${p.code} — ${p.name}`]));
  const n = (d: { toString(): string }) => Number(d.toString());
  const total = run.lines.reduce((s, l) => s + n(l.net), 0);
  const cashCount = run.lines.filter((l) => isCashMode(l.paymentMode)).length;
  const gapRows = run.lines.map((l) => ({ l, gaps: wpsGaps(l) })).filter((x) => x.gaps.length > 0);
  const draft = run.status === "DRAFT";
  const costByProject = [
    ...run.lines
      .reduce((m, l) => {
        const key = l.projectId ?? "";
        const row = m.get(key) ?? { label: l.projectId ? (projectLabel.get(l.projectId) ?? "Removed project") : "No project", count: 0, net: 0 };
        row.count += 1;
        row.net += n(l.net);
        return m.set(key, row);
      }, new Map<string, { label: string; count: number; net: number }>())
      .values(),
  ].sort((a, b) => b.net - a.net);
  // The previous month's run for the same company, to show what changed.
  const prevMonth = previousMonth(run.month);
  const prev = await prisma.payrollRun.findFirst({
    where: { branchId: run.branchId, companyId: run.companyId, month: prevMonth },
    include: { lines: { include: { employee: { select: { id: true, name: true } } } } },
  });
  const variance: VarianceRow[] | null = prev
    ? (() => {
        const before = new Map(prev.lines.map((l) => [l.employeeId, { name: l.employee.name, net: n(l.net) }]));
        const now = new Map(run.lines.map((l) => [l.employeeId, { name: l.employee.name, net: n(l.net) }]));
        return [...new Set([...before.keys(), ...now.keys()])].map((eid) => ({ employeeId: eid, name: (now.get(eid) ?? before.get(eid))!.name, now: now.get(eid)?.net ?? null, before: before.get(eid)?.net ?? null }));
      })()
    : null;
  const rejected = run.lines.filter((l) => l.paymentStatus === "REJECTED").length;
  const resubmit = run.lines.filter((l) => l.paymentStatus === "RESUBMIT").length;
  const threshold = run.branch.payrollApprovalThreshold ? n(run.branch.payrollApprovalThreshold) : null;
  const needsSecondApprover = draft && threshold !== null && total > threshold;

  return (
    <div className="space-y-5">
      <div>
        <Link href="/payroll" className="text-xs text-muted hover:text-secondary">← Payroll</Link>
        <div className="mt-1 flex flex-wrap items-center gap-3">
          <h1 className="text-xl font-semibold tracking-tight text-primary">Payroll — {run.company?.name ?? "Own companies"} · {run.month}</h1>
          {run.payType && <Badge color="blue">{run.payType === "HOURLY" ? "Hourly · from timesheet" : "Basic · from attendance"}</Badge>}
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
        <div className="card p-4"><p className="text-xs uppercase tracking-wide text-muted">Skipped: missing pay details</p><p className="mt-1 text-2xl font-semibold tabular-nums text-primary">{unpaidSetup}</p><p className="text-xs text-muted">{skipped.length > 0 ? skipped.slice(0, 3).map((x) => `${x.name} (${x.reason})`).join("; ") + (skipped.length > 3 ? "…" : "") : "Everyone is in this run"}</p></div>
      </div>

      <RunStepper status={run.status} submitted={!!run.submittedAt} issues={issues.length + gapRows.length} />

      {prev && variance && (
        <RunVariance prevMonth={prevMonth} total={total} prevTotal={prev.lines.reduce((sum, l) => sum + n(l.net), 0)} count={run.lines.length} prevCount={prev.lines.length} rows={variance} />
      )}

      <RunControls
        id={run.id}
        status={run.status}
        submitted={!!run.submittedAt}
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

      {draft && run.returnNote && !run.submittedAt && (
        <div className="card flex gap-3 border-[var(--warning-border)] bg-[var(--warning-soft)] p-4 text-sm">
          <CircleAlert className="mt-0.5 h-4 w-4 shrink-0 text-[var(--warning)]" aria-hidden />
          <p className="text-secondary"><span className="font-medium text-primary">Sent back for correction:</span> {run.returnNote}</p>
        </div>
      )}

      {needsSecondApprover && (
        <div className="card flex gap-3 border-[var(--info-border)] bg-[var(--info-soft)] p-4 text-sm">
          <CircleAlert className="mt-0.5 h-4 w-4 shrink-0 text-[var(--info)]" aria-hidden />
          <p className="text-secondary">
            This run is over the <span className="font-medium text-primary">AED {aed(threshold!)}</span> limit, so it needs approving by someone other than {run.createdBy.name}, who created it.
          </p>
        </div>
      )}

      {!draft && (rejected > 0 || resubmit > 0) && (
        <div className="card flex flex-wrap items-center gap-3 border-[var(--warning-border)] bg-[var(--warning-soft)] p-4 text-sm">
          <CircleAlert className="h-4 w-4 shrink-0 text-[var(--warning)]" aria-hidden />
          <p className="flex-1 text-secondary">
            {rejected > 0 && <><span className="font-medium text-primary">{rejected} rejected by the bank.</span> Fix their details, then use “Use updated bank details”. </>}
            {resubmit > 0 && <><span className="font-medium text-primary">{resubmit} ready to resend.</span></>}
          </p>
          {resubmit > 0 && can(subject, "payroll", "export") && (
            <a className="btn btn-secondary" href={`/api/payroll/${run.id}/sif?only=resubmit`}>Download resend file (.SIF)</a>
          )}
        </div>
      )}

      {issues.filter((i) => i.level === "warn").length > 0 && (
        <div className="card p-4 text-sm">
          <p className="font-medium text-primary">Check before approving</p>
          <ul className="mt-2 space-y-1.5">
            {issues.filter((i) => i.level === "warn").map((i) => (
              <li key={i.text} className="flex items-start gap-2 text-secondary">
                <CircleAlert className="mt-0.5 h-4 w-4 shrink-0 text-[var(--warning)]" aria-hidden />
                <span>{i.text}{i.href && <> <Link href={i.href} className="text-[var(--brand-primary)] hover:underline">Open</Link></>}</span>
              </li>
            ))}
          </ul>
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
                {isHourly ? <th className="px-3 py-3 text-right">Timesheet hrs</th> : <><th className="px-3 py-3 text-right">Absent</th><th className="px-3 py-3 text-right">OT hrs</th><th className="px-3 py-3 text-right">OT pay</th><th className="px-3 py-3 text-right">Absence ded.</th></>}
                <th className="px-3 py-3 text-right">Recurring</th>
                <th className="px-3 py-3">Deduction · Advance · Adjustment</th>
                <th className="px-3 py-3 text-right">Net</th>
                <th className="px-3 py-3">Bank</th>
                {!draft && <th className="px-3 py-3">Payment</th>}
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
                    {isHourly ? (
                      <td className="px-3 py-3 text-right tabular-nums text-secondary">{l.timesheetHours}</td>
                    ) : (
                      <>
                        <td className="px-3 py-3 text-right tabular-nums text-secondary">{l.absentDays}</td>
                        <td className="px-3 py-3 text-right tabular-nums text-secondary">{l.otHours}</td>
                        <td className="px-3 py-3 text-right tabular-nums text-secondary">{aed(n(l.overtimePay))}</td>
                        <td className="px-3 py-3 text-right tabular-nums text-secondary">{n(l.deductions) > 0 ? `−${aed(n(l.deductions))}` : "—"}</td>
                      </>
                    )}
                    <td className="px-3 py-3 text-right tabular-nums text-secondary">
                      {n(l.otherEarnings) > 0 && <span className="block text-[var(--success)]">+{aed(n(l.otherEarnings))}</span>}
                      {n(l.otherDeductions) > 0 && <span className="block">−{aed(n(l.otherDeductions))}</span>}
                      {n(l.otherEarnings) === 0 && n(l.otherDeductions) === 0 && "—"}
                    </td>
                    <td className="px-3 py-3">
                      <LineEditor
                        lineId={l.id} deduction={n(l.manualDeduction)} deductionNote={l.deductionNote ?? ""} advance={n(l.loanDeduction)} advanceNote={l.advanceNote ?? ""}
                        adjustment={n(l.adjustment)} adjustmentNote={l.adjustmentNote ?? ""} disabled={!draft || !!run.submittedAt || !can(subject, "payroll", "edit")}
                      />
                    </td>
                    <td className="px-3 py-3 text-right font-medium tabular-nums text-primary">{aed(n(l.net))}</td>
                    <td className="px-3 py-3">
                      {isCashMode(l.paymentMode) ? <Badge color="slate">Cash</Badge> : gaps.length === 0 ? <Badge color="green">Ready</Badge> : <Badge color="amber">Incomplete</Badge>}
                    </td>
                    {!draft && (
                      <td className="px-3 py-3">
                        <PaymentCell lineId={l.id} status={l.paymentStatus} note={l.paymentNote ?? ""} editable={can(subject, "payroll", "approve")} />
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {costByProject.length > 0 && total > 0 && (
        <section className="card p-5">
          <h2 className="mb-4 text-sm font-semibold text-primary">Cost by project</h2>
          <ul className="space-y-3">
            {costByProject.map((p) => (
              <li key={p.label}>
                <div className="flex items-baseline justify-between gap-3 text-sm">
                  <span className="truncate text-secondary">{p.label} <span className="text-xs text-subtle">· {p.count} {p.count === 1 ? "person" : "people"}</span></span>
                  <span className="tabular shrink-0 font-medium text-primary">AED {aed(p.net)} <span className="text-xs font-normal text-subtle">{Math.round((p.net / total) * 100)}%</span></span>
                </div>
                <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-[var(--surface-sunken)]">
                  <div className="h-full rounded-full bg-[var(--brand-primary)]" style={{ width: `${(p.net / total) * 100}%` }} />
                </div>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-subtle">Based on where each person was assigned when this run was calculated.</p>
        </section>
      )}

      {run.events.length > 0 && (
        <section className="card p-4">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-primary"><HistoryIcon className="h-4 w-4 text-subtle" aria-hidden />Sign-off history</h2>
          <ol className="space-y-2 text-sm">
            {run.events.map((e) => (
              <li key={e.id} className="flex flex-wrap items-baseline gap-x-3">
                <span className="w-28 shrink-0 font-medium text-primary">{EVENT_LABEL[e.action] ?? e.action}</span>
                <span className="text-secondary">{e.userName}</span>
                <span className="text-xs text-subtle">{e.at.toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}</span>
              </li>
            ))}
          </ol>
        </section>
      )}
      <p className="text-xs text-muted">
        Rules: only employees of the selected company are paid. <strong>Basic</strong> companies pay the monthly figure, deducting (base + allowances) ÷ 30 per day marked Absent in attendance, and paying overtime at (base ÷ 240) × the employee&apos;s multiplier. <strong>Hourly</strong> companies pay the hours on that month&apos;s timesheet × the employee&apos;s hourly rate; the timesheet carries one figure per day, so every hour is paid at the hourly rate. Deduction and advance are typed here with a note each and both reduce net pay; the advance starts from any active loan or advance instalment and can be overwritten. Recurring items apply automatically, and nothing typed can take net pay below zero.
      </p>
    </div>
  );
}
