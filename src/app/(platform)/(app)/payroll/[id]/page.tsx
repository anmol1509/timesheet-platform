import Link from "next/link";
import { notFound } from "next/navigation";
import { CircleAlert, History as HistoryIcon } from "lucide-react";
import { prisma } from "@/lib/db";
import { requireUserWithBranch, subjectOf } from "@/lib/auth";
import { isOutsideBranch } from "@/lib/branch";
import { can } from "@/lib/permissions";
import { isCashMode, readDeductionItems, wpsGaps } from "@/lib/payroll";
import { runReadiness, runSkipped } from "@/lib/payrollRun";
import { Badge, type BadgeColor } from "@/components/Badge";
import { EmployeeAvatar } from "@/components/Avatar";
import { LineAdjustCells, RunControls } from "./run-controls";
import { RunStatus, type StatusItem } from "./run-status";
import { BankFixQueue } from "./bank-fix-queue";
import { ChecksPanel } from "./checks-panel";
import { PaymentCell } from "./payment-cell";
import { RunVariance, type VarianceRow } from "./run-insights";
import { DetailView } from "./detail-view";
import { DaysButton } from "./days-panel";
import { AdvancesButton } from "./advances-popup";
import { FixPayPanel, type FixRow } from "./fix-pay-panel";
import { Hint } from "@/components/Hint";
import { anotherApproverExists, needsSeparateApprover } from "@/lib/payrollControls";
import { buildPayslip } from "@/lib/payslip";
import { dueDateFor, dueState } from "@/lib/payrollSchedule";

export const metadata = { title: "Payroll run" };

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
      branch: { select: { code: true, name: true, payrollApprovalThreshold: true, payrollDueDays: true } },
      company: { select: { name: true } },
      createdBy: { select: { name: true } },
      approvedBy: { select: { name: true } },
      events: { orderBy: { at: "desc" }, take: 30 },
      lines: { include: { employee: { select: { id: true, name: true, employeeIdNo: true, photoMimeType: true, supplier: { select: { name: true } } } } }, orderBy: { employee: { name: "asc" } } },
    },
  });
  if (!run || isOutsideBranch(run.branchId, branchId, isSuperAdmin)) notFound();

  // Who in this run still owes an advance or loan: shown beside their name, and totalled above the table so it is not missed at month end.
  const openLoans = await prisma.employeeLoan.findMany({
    where: { branchId: run.branchId, status: "ACTIVE", approvalStatus: "APPROVED", givenDate: { not: null }, employeeId: { in: run.lines.map((l) => l.employeeId) } },
    select: { employeeId: true, principal: true, repaid: true, planPending: true },
  });
  const owedBy = new Map<string, { count: number; owed: number; unscheduled: boolean }>();
  for (const l of openLoans) {
    const left = Math.round((Number(l.principal) - Number(l.repaid)) * 100) / 100;
    if (left <= 0) continue;
    const cur = owedBy.get(l.employeeId) ?? { count: 0, owed: 0, unscheduled: false };
    owedBy.set(l.employeeId, { count: cur.count + 1, owed: Math.round((cur.owed + left) * 100) / 100, unscheduled: cur.unscheduled || l.planPending });
  }
  const owedTotal = Math.round([...owedBy.values()].reduce((t, x) => t + x.owed, 0) * 100) / 100;
  const owedUnscheduled = [...owedBy.values()].filter((x) => x.unscheduled).length;

  // Employees of this company who are not in the run because they lack the pay details its type needs.
  const skipped = await runSkipped(run);
  const unpaidSetup = skipped.length;
  // What each skipped worker has now, so the fix panel starts from it instead of a blank form.
  const skippedEmployees = skipped.length
    ? await prisma.employee.findMany({ where: { id: { in: skipped.map((s) => s.id) } }, select: { id: true, employeeIdNo: true, trade: true, payStructure: true, basicSalary: true, housingAllowance: true, foodAllowance: true, transportAllowance: true, otherAllowance: true, flatMonthlyRate: true, hourlyRate: true } })
    : [];
  const asText = (d: { toString(): string } | null) => (d == null ? "" : String(Number(d.toString())));
  const fixRows: FixRow[] = skipped.map((s) => {
    const e = skippedEmployees.find((x) => x.id === s.id);
    const structure = e?.payStructure ?? "";
    const rate = structure === "ITEMISED" ? asText(e?.basicSalary ?? null) : structure === "HOURLY" ? asText(e?.hourlyRate ?? null) : asText(e?.flatMonthlyRate ?? null);
    return { id: s.id, name: s.name, idNo: e?.employeeIdNo ?? "", trade: e?.trade ?? "", reason: s.reason, kind: s.kind, structure, rate, housing: asText(e?.housingAllowance ?? null), food: asText(e?.foodAllowance ?? null), transport: asText(e?.transportAllowance ?? null), other: asText(e?.otherAllowance ?? null) };
  });
  const canFixPay = run.status === "DRAFT" && can(subject, "payroll.payroll", "edit");
  const hasHourly = run.lines.some((l) => l.payStructure === "HOURLY");
  const hasBasic = run.lines.length === 0 || run.lines.some((l) => l.payStructure !== "HOURLY");

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
  const dueAt = run.dueDate ?? dueDateFor(run.month, run.branch.payrollDueDays);
  const due = dueAt ? dueState(dueAt) : null;
  const D = "hidden px-3 py-3 text-right group-data-[detail=on]:table-cell";
  const DETAIL_INLINE = "hidden group-data-[detail=on]:inline";
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
  const needsSecondApprover = draft && needsSeparateApprover(threshold, total, await anotherApproverExists(run.branchId, user.id));
  const nextMonth = (() => { const [y, m] = run.month.split("-").map(Number); const d = new Date(Date.UTC(y, m, 1)); return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`; })();

  // Everything that needs attention, as chips: each opens its details in a side panel instead of stacking above the workers.
  const step = (run.status === "PAID" ? 4 : run.status === "APPROVED" ? 3 : run.submittedAt ? 2 : 0) as 0 | 2 | 3 | 4;
  const warnings = issues.filter((i) => i.level === "warn");
  const lead = run.status === "PAID" ? "This payroll is paid." : run.status === "APPROVED" ? "Approved: download the bank file and pay." : run.submittedAt ? "Waiting for approval." : run.lines.length === 0 ? "No one is in this run yet." : "Review the numbers, then submit.";
  const leadTone = (run.status === "PAID" ? "done" : run.lines.length === 0 ? "stop" : run.submittedAt ? "wait" : "go") as "go" | "stop" | "wait" | "done";
  const canEditRun = can(subject, "payroll.payroll", "edit") && !run.submittedAt;
  const statusItems: StatusItem[] = [];
  if (run.status === "DRAFT" && fixRows.length > 0) {
    statusItems.push({ key: "left-out", label: `${fixRows.length} not in this run`, tone: "warn", title: "Workers left out of this run", description: "Their pay isn't set up yet. Set it here and they join the run.", content: <FixPayPanel runId={run.id} payType={run.payType} canEdit={canFixPay} rows={fixRows} /> });
  }
  if (draft && gapRows.length > 0) {
    statusItems.push({
      key: "bank", label: `${gapRows.length} need bank details`, tone: "warn", title: `Bank details missing for ${gapRows.length} worker${gapRows.length === 1 ? "" : "s"}`,
      content: <BankFixQueue runId={run.id} canEdit={canEditRun} rows={gapRows.map(({ l, gaps }) => ({ employeeId: l.employee.id, name: l.employee.name, idNo: l.employee.employeeIdNo, gaps, defaults: { personCode: l.personCode ?? "", routingCode: l.routingCode ?? "", iban: l.account ?? "", bankName: l.bankName ?? "" } }))} />,
    });
  }
  if (draft && run.returnNote && !run.submittedAt) {
    statusItems.push({ key: "returned", label: "Sent back for correction", tone: "warn", title: "Sent back for correction", content: <p className="text-sm text-secondary">{run.returnNote}</p> });
  }
  if (needsSecondApprover) {
    statusItems.push({ key: "approver", label: "Needs another approver", tone: "info", title: "Needs another approver", content: <p className="text-sm text-secondary">{threshold !== null ? <>This run is over the <span className="font-medium text-primary">AED {aed(threshold)}</span> limit, so it</> : <>This run</>} needs approving by someone other than {run.createdBy.name}, who prepared it.</p> });
  }
  if (!draft && (rejected > 0 || resubmit > 0)) {
    statusItems.push({
      key: "bank-rejected", label: rejected > 0 ? `${rejected} rejected by the bank` : `${resubmit} ready to resend`, tone: "warn", title: "Bank rejections",
      content: (
        <div className="space-y-3 text-sm text-secondary">
          {rejected > 0 && <p><span className="font-medium text-primary">{rejected} rejected by the bank.</span> Fix their details, then use “Use updated bank details”.</p>}
          {resubmit > 0 && <p><span className="font-medium text-primary">{resubmit} ready to resend.</span></p>}
          {resubmit > 0 && can(subject, "payroll.payroll", "export") && <a className="btn btn-secondary" href={`/api/payroll/${run.id}/sif?only=resubmit`}>Download resend file (.SIF)</a>}
        </div>
      ),
    });
  }
  // "Worth checking": each issue with its workers and the fix beside it (the workers left out have their own chip above).
  const checks = warnings.filter((i) => i.kind !== "skipped");
  if (checks.length > 0) {
    statusItems.push({
      key: "checks", label: `${checks.length} to check`, tone: "warn", title: "Worth checking before you approve",
      description: "Open a worker to correct their days, then recalculate.",
      content: <ChecksPanel runId={run.id} canEdit={canEditRun} issues={checks.map((i) => ({ text: i.text, href: i.href, kind: i.kind, workers: i.workers }))} />,
    });
  }
  if (prev && variance) {
    const prevTotal = prev.lines.reduce((sum, l) => sum + n(l.net), 0);
    const pct = prevTotal > 0 ? ((total - prevTotal) / prevTotal) * 100 : 0;
    statusItems.push({
      key: "variance", label: `vs ${prevMonth}: ${pct >= 0 ? "+" : "−"}${Math.abs(pct).toFixed(0)}%`, tone: Math.abs(pct) >= 10 ? "warn" : "info", title: `Compared with ${prevMonth}`,
      content: <RunVariance prevMonth={prevMonth} total={total} prevTotal={prevTotal} count={run.lines.length} prevCount={prev.lines.length} rows={variance} />,
    });
  }
  if (owedBy.size > 0) {
    statusItems.push({
      key: "advances", label: `AED ${aed(owedTotal)} owed in advances`, tone: owedUnscheduled > 0 ? "warn" : "info", title: "Advances and loans still owed",
      description: owedUnscheduled > 0 ? `${owedUnscheduled} worker${owedUnscheduled === 1 ? " has" : "s have"} an advance with no month chosen, so nothing is taken for it.` : "Set what to deduct this month for each worker.",
      content: (
        <ul className="divide-y divide-[var(--border)] rounded-md border border-default text-sm">
          {run.lines.filter((l) => owedBy.has(l.employee.id)).map((l) => {
            const o = owedBy.get(l.employee.id)!;
            return (
              <li key={l.employeeId} className="flex items-center justify-between gap-3 px-3 py-2">
                <span className="min-w-0 truncate text-primary">{l.employee.name} <span className="text-xs text-subtle">AED {aed(o.owed)} owed</span></span>
                <AdvancesButton runId={run.id} employeeId={l.employee.id} name={l.employee.name} count={o.count} owed={o.owed} unscheduled={o.unscheduled} />
              </li>
            );
          })}
        </ul>
      ),
    });
  }

  return (
    <div className="space-y-5">
      <div>
        <Link href="/payroll" className="text-xs text-muted hover:text-secondary">← Payroll</Link>
        <div className="mt-1 flex flex-wrap items-center gap-3">
          <h1 className="text-xl font-semibold tracking-tight text-primary">Payroll — {run.company?.name ?? "Own companies"} · {run.month}</h1>
          {run.payType && <Badge color="blue">{run.payType === "HOURLY" ? "Paid by the hour · from timesheets" : "Monthly salary · from attendance"}</Badge>}
          <Badge color={STATUS[run.status]?.color ?? "slate"} dot>{STATUS[run.status]?.label ?? run.status}</Badge>
        </div>
        <p className="mt-1 text-sm text-muted">
          {run.branch.name} · created by {run.createdBy.name}
          {run.approvedBy && ` · approved by ${run.approvedBy.name}`}
          {dueAt && <> · salaries due {dueAt.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" })}{run.status !== "PAID" && due?.overdue && <span className="ml-1 font-medium text-[var(--error)]">({due.daysLate} day{due.daysLate === 1 ? "" : "s"} late)</span>}</>}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="card p-4"><p className="text-xs uppercase tracking-wide text-muted">Total net pay</p><p className="mt-1 text-2xl font-semibold tabular-nums text-primary">AED {aed(total)}</p></div>
        <div className="card p-4"><p className="text-xs uppercase tracking-wide text-muted">Employees</p><p className="mt-1 text-2xl font-semibold tabular-nums text-primary">{run.lines.length}</p>{cashCount > 0 && <p className="text-xs text-muted">{cashCount} paid in cash (not in WPS file)</p>}</div>
        <div className="card p-4"><p className="text-xs uppercase tracking-wide text-muted">Not in this run</p><p className="mt-1 text-2xl font-semibold tabular-nums text-primary">{unpaidSetup}</p><p className="text-xs text-muted">{skipped.length > 0 ? skipped.slice(0, 3).map((x) => `${x.name} (${x.reason})`).join("; ") + (skipped.length > 3 ? "…" : "") : "Everyone is included"}</p></div>
      </div>

      <RunStatus step={step} lead={lead} leadTone={leadTone} items={statusItems} />

      <RunControls
        id={run.id}
        status={run.status}
        submitted={!!run.submittedAt}
        canEdit={can(subject, "payroll.payroll", "edit")}
        canApprove={can(subject, "payroll.payroll", "approve")}
        canExport={can(subject, "payroll.payroll", "export")}
        canDelete={can(subject, "payroll.payroll", "delete")}
      />

      {run.lines.length === 0 ? (
        <div className="card p-10 text-center text-sm text-muted">No employees have a pay structure yet. Set one on each employee&apos;s Payroll &amp; WPS tab, then Recalculate.</div>
      ) : (
        <DetailView>
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-default bg-surface-subtle text-left text-xs font-medium uppercase tracking-wide text-muted">
              <tr>
                <th className="px-3 py-3">Employee</th>
                <th className={D}>Base</th>
                <th className={D}>Allow.</th>
                {hasHourly && <th className={D}>Timesheet hrs</th>}
                {hasBasic && <><th className={D}>Absent</th><th className={D}>OT hrs</th><th className={D}>OT pay</th><th className={D}>Absence ded.</th></>}
                <th className={D}>Recurring</th>
                <th className="px-3 py-3 text-right">Earns</th>
                <th className="px-3 py-3 text-right">Deductions</th>
                <th className="px-2 py-3 text-right">Deduction</th>
                <th className="px-2 py-3 text-right">Advance</th>
                <th className="px-2 py-3 text-right">Adjustment</th>
                <th className="px-2 py-3 text-right" title="What the bank charges to pay this worker, typed here per worker. Tick Waive to take nothing.">Bank charge</th>
                {draft && <th className="relative px-2 py-3"><span className="sr-only">Save</span></th>}
                <th className="px-3 py-3 text-right">Net pay<Hint term="NET_PAY" /></th>
                <th className="px-3 py-3">Bank<Hint term="WPS" /></th>
                {!draft && <th className="px-3 py-3">Payment</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {run.lines.map((l) => {
                const gaps = wpsGaps(l);
                const slip = buildPayslip({
                  payStructure: l.payStructure, basic: n(l.basic), allowances: n(l.allowances), overtimePay: n(l.overtimePay), deductions: n(l.deductions), adjustment: n(l.adjustment), adjustmentNote: l.adjustmentNote,
                  otherEarnings: n(l.otherEarnings), otherDeductions: n(l.otherDeductions), manualDeduction: n(l.manualDeduction), deductionNote: l.deductionNote, deductionItems: readDeductionItems(l.deductionItems), loanDeduction: n(l.loanDeduction), advanceNote: l.advanceNote, gasCharge: n(l.gasCharge), bankCharge: l.bankChargeWaived ? 0 : n(l.bankCharge), shortfallHours: n(l.shortfallHours), shortfallDeduction: n(l.shortfallDeduction),
                  absentDays: n(l.absentDays), unpaidLeaveDays: 0, otHours: n(l.otHours), restHours: 0, normalHours: 0, employedDays: l.employedDays, daysInMonth: l.daysInMonth ?? 30, net: n(l.net),
                });
                const editable = draft && !run.submittedAt && can(subject, "payroll.payroll", "edit");
                return (
                  <tr key={l.employeeId} className="align-top" data-name={`${l.employee.name} ${l.employee.employeeIdNo}`.toLowerCase()} data-bank={isCashMode(l.paymentMode) ? "cash" : gaps.length === 0 ? "ok" : "fix"} data-pay={l.paymentStatus}>
                    <td className="min-w-[13rem] px-3 py-3">
                      <div className="flex items-center gap-3">
                        <EmployeeAvatar employeeId={l.employee.id} name={l.employee.name} hasPhoto={!!l.employee.photoMimeType} size="md" />
                        <div className="min-w-0">
                          <Link href={`/employees/${l.employee.id}`} target="_blank" rel="noopener noreferrer" className="font-medium text-primary hover:underline">{l.employee.name}</Link>
                          <p className="text-xs text-muted">{l.employee.employeeIdNo}{l.employee.supplier && run.company && l.employee.supplier.name !== run.company.name && <span className="text-muted"> · Employer {l.employee.supplier.name}</span>}{l.employedDays != null && <span className="font-medium text-[var(--warning)]"> · {l.employedDays} of {l.daysInMonth} days</span>} · <DaysButton runId={run.id} employeeId={l.employee.id} name={l.employee.name} />{owedBy.has(l.employee.id) && <> · <AdvancesButton runId={run.id} employeeId={l.employee.id} name={l.employee.name} count={owedBy.get(l.employee.id)!.count} owed={owedBy.get(l.employee.id)!.owed} unscheduled={owedBy.get(l.employee.id)!.unscheduled} /></>}<span className={DETAIL_INLINE}><br />{l.payStructure === "FLAT" ? "Fixed monthly rate" : l.payStructure === "HOURLY" ? "Paid by the hour" : "Basic + allowances"} · <Link href={`/letters?employee=${l.employee.id}&template=salary`} className="hover:underline">Salary certificate</Link></span></p>
                        </div>
                      </div>
                    </td>
                    <td className={`${D} tabular-nums text-secondary`}>{aed(n(l.basic))}</td>
                    <td className={`${D} tabular-nums text-secondary`}>{aed(n(l.allowances))}</td>
                    {hasHourly && <td className={`${D} tabular-nums text-secondary`}>{l.payStructure === "HOURLY" ? l.timesheetHours : "—"}</td>}
                    {hasBasic && (l.payStructure === "HOURLY" ? (
                      <td colSpan={4} className={`${D} text-xs text-subtle`}>paid from timesheet hours</td>
                    ) : (
                      <>
                        <td className={`${D} tabular-nums text-secondary`}>{l.absentDays}</td>
                        <td className={`${D} tabular-nums text-secondary`}>{l.otHours}</td>
                        <td className={`${D} tabular-nums text-secondary`}>{aed(n(l.overtimePay))}</td>
                        <td className={`${D} tabular-nums text-secondary`}>{n(l.deductions) > 0 ? `−${aed(n(l.deductions))}` : "—"}</td>
                      </>
                    ))}
                    <td className={`${D} tabular-nums text-secondary`}>
                      {n(l.otherEarnings) > 0 && <span className="block text-[var(--success)]">+{aed(n(l.otherEarnings))}</span>}
                      {n(l.otherDeductions) > 0 && <span className="block">−{aed(n(l.otherDeductions))}</span>}
                      {n(l.gasCharge) > 0 && <span className="block" title="Gas charge">−{aed(n(l.gasCharge))} gas</span>}
                      {n(l.shortfallDeduction) > 0 && <span className="block" title={`${n(l.shortfallHours)} h short on days worked less than the standard day`}>−{aed(n(l.shortfallDeduction))} short hrs</span>}
                      {n(l.otherEarnings) === 0 && n(l.otherDeductions) === 0 && n(l.gasCharge) === 0 && n(l.shortfallDeduction) === 0 && "—"}
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums text-secondary">{aed(slip.gross)}</td>
                    <td className="px-3 py-3 text-right tabular-nums text-secondary">{slip.totalDeductions > 0 ? `−${aed(slip.totalDeductions)}` : "—"}</td>
                    <LineAdjustCells
                      lineId={l.id} deduction={n(l.manualDeduction)} deductionNote={l.deductionNote ?? ""} advance={n(l.loanDeduction)} advanceNote={l.advanceNote ?? ""}
                      adjustment={n(l.adjustment)} adjustmentNote={l.adjustmentNote ?? ""} bankCharge={n(l.bankCharge)} bankWaived={l.bankChargeWaived} disabled={!editable}
                    />
                    {!editable && draft && <td />}
                    <td className="px-3 py-3 text-right font-semibold tabular-nums text-primary">{aed(n(l.net))}</td>
                    <td className="px-3 py-3">
                      {isCashMode(l.paymentMode) ? <Badge color="slate">Cash</Badge> : gaps.length === 0 ? <Badge color="green">Ready</Badge> : <Badge color="amber">Needs fixing</Badge>}
                    </td>
                    {!draft && (
                      <td className="px-3 py-3">
                        <PaymentCell lineId={l.id} status={l.paymentStatus} note={l.paymentNote ?? ""} editable={can(subject, "payroll.payroll", "approve")} canCorrect={can(subject, "payroll.payroll", "edit")} nextMonth={nextMonth} />
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        </DetailView>
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
      <details className="text-xs text-muted">
        <summary className="cursor-pointer font-medium text-secondary">How is this calculated?</summary>
        <p className="mt-2">
        Rules: only employees sponsored by the selected company are paid (or its own employees where no sponsor is set); employees of companies that are not yours are left out. <strong>Basic</strong> companies pay the monthly figure, deducting (base + allowances) ÷ 30 per day marked Absent in attendance, and paying overtime at (base ÷ 240) × the employee&apos;s multiplier. <strong>Hourly</strong> companies pay the hours on that month&apos;s timesheet × the employee&apos;s hourly rate; the timesheet carries one figure per day, so every hour is paid at the hourly rate. Deduction and advance are typed here with a note each and both reduce net pay; the advance starts from any active loan or advance instalment and can be overwritten. Recurring items apply automatically, and nothing typed can take net pay below zero.
        </p>
      </details>
    </div>
  );
}
