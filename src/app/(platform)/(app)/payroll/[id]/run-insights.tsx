import Link from "next/link";
import { ArrowDownRight, ArrowUpRight, Check, Minus } from "lucide-react";
import { cn } from "@/lib/cn";

const aed = (n: number) => n.toLocaleString("en-AE", { maximumFractionDigits: 0 });

/** Where the run is: Review, Submit, Approve, Pay. Derived from what is already on the run — it adds no state of its own. */
export function RunStepper({ status, submitted, issues }: { status: string; submitted: boolean; issues: number }) {
  const current = status === "PAID" ? 4 : status === "APPROVED" ? 3 : submitted ? 2 : 0;
  const steps = [
    { t: "Review", d: issues > 0 ? `${issues} to fix` : "Numbers check out" },
    { t: "Submit", d: "Send for approval" },
    { t: "Approve", d: "A second person signs off" },
    { t: "Pay", d: "WPS file and bank" },
  ];
  return (
    <ol className="card grid gap-3 p-4 sm:grid-cols-4" aria-label="Payroll run progress">
      {steps.map((s, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <li key={s.t} className="flex items-start gap-3" aria-current={active ? "step" : undefined}>
            <span className={cn("flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold", done ? "bg-[var(--success-soft)] text-[var(--success)]" : active ? "bg-[var(--brand-primary)] text-white" : "bg-surface-sunken text-muted")}>
              {done ? <Check className="h-3.5 w-3.5" aria-hidden /> : i + 1}
            </span>
            <span className="min-w-0">
              <span className={cn("block text-sm font-medium", done || active ? "text-primary" : "text-muted")}>{s.t}</span>
              <span className={cn("block text-xs", active && i === 0 && issues > 0 ? "font-medium text-[var(--warning)]" : "text-subtle")}>{s.d}</span>
            </span>
          </li>
        );
      })}
    </ol>
  );
}

export type VarianceRow = { employeeId: string; name: string; now: number | null; before: number | null };

/** This month against the previous run for the same company, with the people whose pay moved most. */
export function RunVariance({ prevMonth, total, prevTotal, count, prevCount, rows }: { prevMonth: string; total: number; prevTotal: number; count: number; prevCount: number; rows: VarianceRow[] }) {
  const delta = total - prevTotal;
  const pct = prevTotal > 0 ? (delta / prevTotal) * 100 : 0;
  const Icon = delta > 0 ? ArrowUpRight : delta < 0 ? ArrowDownRight : Minus;
  const notable = rows
    .map((r) => ({ ...r, change: r.now === null ? -(r.before ?? 0) : r.before === null ? r.now : r.now - r.before }))
    .filter((r) => r.now === null || r.before === null || (r.before > 0 && Math.abs(r.change) / r.before >= 0.15))
    .sort((a, b) => Math.abs(b.change) - Math.abs(a.change))
    .slice(0, 6);
  return (
    <section className="card p-4" aria-label="Compared with last month">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-primary">Compared with {prevMonth}</h2>
          <p className="text-xs text-muted">Last run: AED {aed(prevTotal)} across {prevCount} people</p>
        </div>
        <p className={cn("flex items-center gap-1 text-sm font-semibold tabular-nums", Math.abs(pct) >= 10 ? "text-[var(--warning)]" : "text-primary")}>
          <Icon className="h-4 w-4" aria-hidden />
          {delta >= 0 ? "+" : "−"}AED {aed(Math.abs(delta))} ({pct >= 0 ? "+" : "−"}{Math.abs(pct).toFixed(1)}%)
        </p>
      </div>
      {count !== prevCount && <p className="mt-2 text-xs text-secondary">Headcount {count > prevCount ? "up" : "down"} by {Math.abs(count - prevCount)} ({prevCount} → {count}).</p>}
      {notable.length > 0 ? (
        <ul className="mt-3 divide-y divide-[var(--border)] text-sm">
          {notable.map((r) => (
            <li key={r.employeeId} className="flex items-center justify-between gap-3 py-1.5">
              <Link href={`/employees/${r.employeeId}`} target="_blank" rel="noopener noreferrer" className="truncate text-primary hover:underline">{r.name}</Link>
              <span className="tabular shrink-0 text-xs text-secondary">
                {r.before === null ? <span className="text-[var(--info)]">New this month · AED {aed(r.now ?? 0)}</span> : r.now === null ? <span className="text-[var(--warning)]">Not in this run (was AED {aed(r.before)})</span> : <>AED {aed(r.before)} → <span className="font-medium text-primary">{aed(r.now)}</span></>}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-xs text-muted">No individual moved by more than 15%.</p>
      )}
    </section>
  );
}

/**
 * The one sentence a person needs: what state the run is in and what to do now.
 * The detail (who, which bank field) lives in the checks below it.
 */
export function NextStep({ status, submitted, blocking, warnings, people, canApprove }: { status: string; submitted: boolean; blocking: number; warnings: number; people: number; canApprove: boolean }) {
  let tone: "go" | "stop" | "wait" | "done" = "go";
  let title = "";
  let body = "";
  if (status === "PAID") { tone = "done"; title = "This payroll is paid"; body = "Payslips are ready to share. Nothing else to do for this month."; }
  else if (status === "APPROVED") { tone = "go"; title = "Approved: pay your people"; body = canApprove ? "Download the bank file (WPS: the UAE salary system), upload it in your bank's online portal, then press “Mark as paid”." : "Waiting for an approver to download the bank file and mark it as paid."; }
  else if (submitted) { tone = "wait"; title = "Waiting for approval"; body = "It has been sent to the approvals inbox. You will see it here once someone signs it off."; }
  else if (people === 0) { tone = "stop"; title = "No one is in this run yet"; body = "Add pay details to your employees (their Payroll & WPS tab), then press Recalculate."; }
  else if (blocking > 0) { tone = "stop"; title = `Fix ${blocking} ${blocking === 1 ? "person" : "people"} before you can submit`; body = "Their bank details are incomplete. Press “Fix now” beside each name in the “Needs fixing” box below."; }
  else { tone = "go"; title = "Review the numbers, then submit"; body = warnings > 0 ? `Everything needed is there. ${warnings} thing${warnings === 1 ? "" : "s"} worth a quick look under “Worth checking”.` : "Everything needed is there. Look over the totals, then press Submit for approval."; }
  const ring = tone === "stop" ? "border-[var(--warning-border)] bg-[var(--warning-soft)]" : tone === "done" ? "border-[var(--success-border)] bg-[var(--success-soft)]" : "border-[var(--info-border)] bg-[var(--info-soft)]";
  return (
    <div className={cn("card border p-4", ring)} role="status">
      <p className="text-xs font-medium uppercase tracking-wide text-muted">What to do now</p>
      <p className="mt-0.5 text-base font-semibold text-primary">{title}</p>
      <p className="mt-0.5 text-sm text-secondary">{body}</p>
    </div>
  );
}
