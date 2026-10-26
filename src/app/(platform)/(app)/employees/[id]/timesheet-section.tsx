import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { prisma } from "@/lib/db";
import { Badge } from "@/components/Badge";
import { cn } from "@/lib/cn";
import { employmentWindow, monthBounds } from "@/lib/payroll";
import { parseDailyHours } from "@/lib/timesheetCells";
import { buildEmployeeMonth, type MonthKind } from "@/lib/employeeMonth";
import { monthLabelFromKey } from "@/lib/timesheetSummary";

const iso = (d: Date) => d.toISOString().slice(0, 10);
const KIND_TONE: Partial<Record<MonthKind, string>> = { absent: "text-[var(--error)] font-medium", leave: "text-[var(--warning)]", sick: "text-[var(--warning)]", unrecorded: "text-subtle", outside: "text-subtle", off: "text-muted", holiday: "text-muted", idle: "text-muted" };
const shiftMonth = (m: string, by: number) => { const [y, mo] = m.split("-").map(Number); const d = new Date(Date.UTC(y, mo - 1 + by, 1)); return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`; };

/**
 * One worker's month, read-only: attendance beside the client's timesheet for each day, with totals and where they disagree.
 * The month comes from ?month=; with none it opens on the latest month that has anything recorded.
 */
export async function EmployeeTimesheetSection({ employee, month, canViewRates, canEditAttendance }: {
  employee: { id: string; employeeIdNo: string; branchId: string; supplierId: string | null; joinDate: Date | null; exitDate: Date | null; project: { weeklyOffDays: number[] } | null };
  month: string | null;
  /** Billing rates are money figures: shown only to people who may see pay. */
  canViewRates: boolean;
  canEditAttendance: boolean;
}) {
  // Months with anything recorded, newest first, to jump between.
  const [attMonths, sheetMonths] = await Promise.all([
    prisma.$queryRaw<{ m: string }[]>`select distinct to_char("date", 'YYYY-MM') as m from "Attendance" where "employeeId" = ${employee.id} order by 1 desc limit 24`,
    prisma.timesheetEntry.findMany({ where: { employeeIdNo: employee.employeeIdNo, branchId: employee.branchId }, distinct: ["month"], select: { month: true }, orderBy: { month: "desc" }, take: 24 }),
  ]);
  const known = [...new Set([...attMonths.map((x) => x.m), ...sheetMonths.map((x) => x.month)])].sort().reverse();
  const nowKey = new Date().toISOString().slice(0, 7);
  const chosen = month && monthBounds(month) ? month : known[0] ?? nowKey;
  const bounds = monthBounds(chosen)!;

  const [att, sheets] = await Promise.all([
    prisma.attendance.findMany({ where: { employeeId: employee.id, date: { gte: bounds.start, lte: bounds.end } }, select: { date: true, status: true, normalHours: true, otHours: true } }),
    prisma.timesheetEntry.findMany({
      where: { employeeIdNo: employee.employeeIdNo, branchId: employee.branchId, month: chosen },
      orderBy: { updatedAt: "desc" },
      select: { id: true, dailyHours: true, status: true, supplierId: true, trade: true, rate: true, totalHours: true, supplier: { select: { name: true } }, client: { select: { name: true } } },
    }),
  ]);
  const sheet = sheets.find((s) => s.supplierId === employee.supplierId) ?? sheets[0] ?? null;
  const cells = new Map((sheet ? parseDailyHours(sheet.dailyHours) : []).map((c) => [c.date, c.value]));
  const byDate = new Map(att.map((a) => [iso(a.date), a]));
  const window = employmentWindow(bounds, employee.joinDate, employee.exitDate);

  const days = Array.from({ length: bounds.days }, (_, i) => {
    const date = iso(new Date(Date.UTC(bounds.start.getUTCFullYear(), bounds.start.getUTCMonth(), i + 1)));
    const a = byDate.get(date);
    return { date, status: a?.status ?? null, normalHours: a?.normalHours ?? null, otHours: a?.otHours ?? null, ts: sheet ? (cells.get(date) ?? "") : null };
  });
  const { rows, totals } = buildEmployeeMonth({
    days, hasTimesheet: !!sheet,
    from: window ? iso(window.from) : "9999-12-31", to: window ? iso(window.to) : "0000-01-01",
    weeklyOffDays: employee.project?.weeklyOffDays ?? [0],
  });
  const tab = (m: string) => `?tab=timesheet&month=${m}`;
  const recorded = att.length > 0 || !!sheet;

  return (
    <section className="space-y-4" aria-label="Timesheet">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1">
          <Link href={tab(shiftMonth(chosen, -1))} scroll={false} className="btn btn-secondary btn-sm px-2" aria-label="Previous month"><ChevronLeft className="h-4 w-4" aria-hidden /></Link>
          <h2 className="min-w-36 text-center text-base font-semibold text-primary">{monthLabelFromKey(chosen)}</h2>
          <Link href={tab(shiftMonth(chosen, 1))} scroll={false} className="btn btn-secondary btn-sm px-2" aria-label="Next month"><ChevronRight className="h-4 w-4" aria-hidden /></Link>
        </div>
        {canEditAttendance && <Link href={`/attendance?month=${chosen}`} className="text-sm font-medium text-[var(--brand-primary)] hover:underline">Edit in Daily Attendance →</Link>}
      </div>

      {known.length > 0 && (
        <div className="flex flex-wrap gap-1.5" aria-label="Months with records">
          {known.slice(0, 12).map((m) => (
            <Link key={m} href={tab(m)} scroll={false} aria-current={m === chosen} className={cn("rounded-full border px-2.5 py-0.5 text-xs", m === chosen ? "border-brand bg-brand-soft font-medium text-primary" : "border-default text-muted hover:text-primary")}>{monthLabelFromKey(m)}</Link>
          ))}
        </div>
      )}

      {!window && <p className="rounded-md border border-default bg-surface-subtle px-3 py-2 text-sm text-secondary">This person was not employed in {monthLabelFromKey(chosen)}.</p>}
      {window && !recorded && <p className="rounded-md border border-dashed border-default px-3 py-6 text-center text-sm text-muted">Nothing recorded for {monthLabelFromKey(chosen)}: no attendance and no client timesheet.</p>}

      {window && recorded && (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
            {[
              ["Days worked", totals.workedDays], ["Hours", totals.hours], ["Overtime h", totals.ot], ["Absent", totals.absent], ["Leave / sick", totals.leave + totals.sick], ["Off / holiday", totals.off], ["Client sheet h", sheet ? totals.sheetHours : "—"],
            ].map(([label, value]) => (
              <div key={String(label)} className="card px-3 py-2.5">
                <p className="text-[11px] font-medium tracking-wide text-muted uppercase">{label}</p>
                <p className={cn("tabular mt-0.5 text-lg font-semibold", label === "Absent" && Number(value) > 0 ? "text-[var(--error)]" : "text-primary")}>{value}</p>
              </div>
            ))}
          </div>

          <div className={cn("flex flex-wrap items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm", !sheet ? "border-default bg-surface-subtle text-secondary" : totals.mismatches === 0 ? "border-[var(--success-border)] bg-[var(--success-soft)] text-[var(--success)]" : "border-[var(--warning-border)] bg-[var(--warning-soft)] text-[var(--warning)]")}>
            <span className="font-medium">
              {!sheet ? "No client timesheet for this month, so there is nothing to compare attendance with." : totals.mismatches === 0 ? "Attendance matches the client timesheet on every day." : `${totals.mismatches} day${totals.mismatches === 1 ? "" : "s"} differ from the client timesheet.`}
            </span>
            {sheet && (
              <span className="flex flex-wrap items-center gap-2 text-xs text-secondary">
                {[sheet.client?.name, sheet.supplier.name, sheet.trade].filter(Boolean).join(" · ")}
                {canViewRates && sheet.rate > 0 && <span className="tabular">· AED {sheet.rate.toFixed(2)} / hour</span>}
                <Badge color="slate">{sheet.status.toLowerCase().replace("_", " ")}</Badge>
              </span>
            )}
          </div>
          {sheets.length > 1 && <p className="text-xs text-muted">{sheets.length} client timesheets exist for this month; the one for this person&rsquo;s own company is shown.</p>}

          <div className="overflow-x-auto rounded-md border border-default">
            <table className="w-full text-sm">
              <thead className="bg-surface-subtle text-left text-xs font-medium tracking-wide text-muted uppercase">
                <tr><th className="px-3 py-2">Date</th><th className="px-3 py-2">Attendance</th><th className="px-3 py-2 text-right">Hours</th><th className="px-3 py-2 text-right">Overtime</th><th className="px-3 py-2">Client timesheet</th></tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {rows.map((r) => (
                  <tr key={r.date} className={cn(r.kind === "absent" && "bg-[var(--error-soft)]/40", r.sync === "differs" && r.kind !== "outside" && "bg-[var(--warning-soft)]/50", (r.kind === "off" || r.kind === "holiday" || r.kind === "outside") && "text-muted")}>
                    <td className="px-3 py-1.5 font-medium whitespace-nowrap">{r.date.slice(8)} {r.weekday}</td>
                    <td className={cn("px-3 py-1.5", KIND_TONE[r.kind])}>{r.label}</td>
                    <td className="tabular px-3 py-1.5 text-right">{r.hours > 0 ? r.hours : "—"}</td>
                    <td className="tabular px-3 py-1.5 text-right">{r.ot > 0 ? r.ot : "—"}</td>
                    <td className="px-3 py-1.5 text-xs">
                      {r.kind === "outside" || r.sync === "unchecked" ? <span className="text-subtle">{r.ts ? r.ts : "—"}</span> : r.sync === "match" ? <span className="text-[var(--success)]">{r.ts || "—"} ✓</span> : <span className="font-medium text-[var(--warning)]">Sheet: {r.ts || "blank"}</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="border-t border-default bg-surface-subtle text-sm font-medium">
                <tr><td className="px-3 py-2" colSpan={2}>Total</td><td className="tabular px-3 py-2 text-right">{totals.hours}</td><td className="tabular px-3 py-2 text-right">{totals.ot || "—"}</td><td className="px-3 py-2 text-xs font-normal text-muted">{sheet ? `${totals.sheetHours} h on the sheet` : ""}</td></tr>
              </tfoot>
            </table>
          </div>
        </>
      )}
    </section>
  );
}
