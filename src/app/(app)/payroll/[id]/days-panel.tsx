"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CalendarDays } from "lucide-react";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/Dialog";
import { Badge } from "@/components/Badge";
import { cn } from "@/lib/cn";
import { Hint } from "@/components/Hint";
import { alignDayAction, loadPayDaysAction, saveDayAction, setShortfallDayAction } from "../day-actions";
import { recomputeRunAction, saveLineAction } from "../actions";
import type { PayDaysView } from "@/lib/payDaysData";

const aed = (n: number) => n.toLocaleString("en-AE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const dash = (n: number, sign = "") => (n === 0 ? "—" : `${sign}${aed(n)}`);
const showShort = (v: PayDaysView) => !v.hourly && v.shortRule.mode !== "OFF";
const HOURLY_STATUS = new Set(["PRESENT", "ABSENT", "OFF", "HOLIDAY"]);
const STATUS_OPTIONS = [["PRESENT", "Present"], ["ABSENT", "Absent"], ["LEAVE", "Leave"], ["SICK_LEAVE", "Sick"], ["IDLE", "Idle"], ["HOLIDAY", "Holiday"], ["OFF", "Off"]] as const;

/** "View days" on a run line: every day's status, hours and pay, with the client timesheet beside it, and edit while the run is a draft. */
export function DaysButton({ runId, employeeId, name }: { runId: string; employeeId: string; name: string }) {
  const router = useRouter();
  const [view, setView] = useState<PayDaysView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState({ status: "PRESENT", normalHours: "", otHours: "" });
  const [adj, setAdj] = useState<{ deduction: string; deductionNote: string; advance: string; advanceNote: string; adjustment: string; adjustmentNote: string } | null>(null);
  const [saved, setSaved] = useState(false);

  function load(open: boolean) {
    if (!open) return;
    setError(null);
    start(async () => {
      const r = await loadPayDaysAction(runId, employeeId);
      if (r.error || !r.view) setError(r.error ?? "Could not load the days."); else { setView(r.view); setAdj(adjFrom(r.view)); setSaved(false); }
    });
  }
  function apply(fn: () => Promise<{ error: string | null; view?: PayDaysView }>) {
    setError(null);
    start(async () => {
      const r = await fn();
      if (r.error) { setError(r.error); return; }
      if (r.view) { setView(r.view); setAdj(adjFrom(r.view)); }
      setEditing(null);
      router.refresh();
    });
  }
  const toggleShort = (date: string, count: boolean) => apply(() => { const fd = new FormData(); fd.set("runId", runId); fd.set("employeeId", employeeId); fd.set("date", date); fd.set("count", count ? "1" : "0"); return setShortfallDayAction(fd); });
  function saveAdjustments() {
    if (!view || !adj) return;
    setError(null);
    start(async () => {
      const fd = new FormData();
      fd.set("lineId", view.adjust.lineId);
      for (const [k, v] of Object.entries(adj)) fd.set(k, v);
      const res = await saveLineAction(fd);
      if (res.error) { setError(res.error); return; }
      const r = await loadPayDaysAction(runId, employeeId);
      if (r.view) { setView(r.view); setAdj(adjFrom(r.view)); }
      setSaved(true);
      router.refresh();
    });
  }
  function recalculate() {
    setError(null);
    start(async () => {
      const fd = new FormData();
      fd.set("id", runId);
      const res = await recomputeRunAction(fd);
      if (res.error) { setError(res.error); return; }
      const r = await loadPayDaysAction(runId, employeeId);
      if (r.view) { setView(r.view); setAdj(adjFrom(r.view)); }
      router.refresh();
    });
  }
  const adjDirty = !!view && !!adj && (Number(adj.deduction || 0) !== view.adjust.deduction || adj.deductionNote !== view.adjust.deductionNote || Number(adj.advance || 0) !== view.adjust.advance || adj.advanceNote !== view.adjust.advanceNote || Number(adj.adjustment || 0) !== view.adjust.adjustment || adj.adjustmentNote !== view.adjust.adjustmentNote);
  const setA = (k: keyof NonNullable<typeof adj>) => (e: React.ChangeEvent<HTMLInputElement>) => { setSaved(false); setAdj((p) => (p ? { ...p, [k]: e.target.value } : p)); };
  const save = (date: string) => apply(() => { const fd = new FormData(); fd.set("runId", runId); fd.set("employeeId", employeeId); fd.set("date", date); for (const [k, v] of Object.entries(draft)) fd.set(k, v); return saveDayAction(fd); });
  const align = (date: string) => apply(() => { const fd = new FormData(); fd.set("runId", runId); fd.set("employeeId", employeeId); fd.set("date", date); return alignDayAction(fd); });

  return (
    <Dialog onOpenChange={load}>
      <DialogTrigger asChild>
        <button type="button" className="inline-flex items-center gap-1 text-xs font-medium text-[var(--brand-primary)] hover:underline"><CalendarDays className="h-3 w-3" aria-hidden /> View days</button>
      </DialogTrigger>
      <DialogContent title={`${name}: day by day`} description={view ? `Pay for ${view.month}, with the client timesheet beside it.` : undefined} className="max-w-5xl!">
        {!view && !error && <p className="mt-6 text-sm text-muted">Loading…</p>}
        {error && <p role="alert" className="mt-3 rounded-md border border-[var(--error-border)] bg-[var(--error-soft)] px-3 py-2 text-sm text-[var(--error)]">{error}</p>}
        {view && (
          <div className="mt-4 space-y-4">
            <div className={cn("grid gap-3", showShort(view) ? "sm:grid-cols-5" : "sm:grid-cols-4")}>
              <Stat label="Salary for the days" value={`AED ${aed(view.totals.salary)}`} />
              <Stat label={`Overtime${view.totals.ot + view.totals.rest > 0 ? ` (${view.totals.ot + view.totals.rest} h)` : ""}`} value={`AED ${aed(view.totals.otPay)}`} />
              <Stat label={`Absence${view.totals.absent > 0 ? ` (${view.totals.absent} day${view.totals.absent === 1 ? "" : "s"})` : ""}`} value={view.totals.deduction > 0 ? `−AED ${aed(view.totals.deduction)}` : "AED 0.00"} />
              {showShort(view) && <Stat label={`Short hours${view.totals.shortHours > 0 ? ` (${view.totals.shortHours} h)` : ""}`} value={view.totals.shortfall > 0 ? `−AED ${aed(view.totals.shortfall)}` : "AED 0.00"} />}
              <Stat label="Net pay" value={`AED ${aed(view.lineNet)}`} strong />
            </div>

            <div className={cn("flex flex-wrap items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm", !view.hasTimesheet ? "border-default bg-surface-subtle text-secondary" : view.totals.mismatches === 0 && view.edits.length === 0 ? "border-[var(--success-border)] bg-[var(--success-soft)] text-[var(--success)]" : "border-[var(--warning-border)] bg-[var(--warning-soft)] text-[var(--warning)]")}>
              <span className="font-medium">
                {view.hourly ? (view.edits.length > 0 ? `Paid from the timesheet hours, but ${view.edits.length} day${view.edits.length === 1 ? " was" : "s were"} changed in payroll after the timesheet was made.` : "Paid from the client timesheet hours.") : !view.hasTimesheet ? "No client timesheet for this month yet, so there is nothing to compare with." : view.totals.mismatches === 0 ? "Attendance matches the client timesheet on every day." : `${view.totals.mismatches} day${view.totals.mismatches === 1 ? "" : "s"} differ from the client timesheet.`}
              </span>
              {view.hasTimesheet && view.timesheetStatus && <Badge color={view.edits.length > 0 ? "amber" : "slate"}>Timesheet: {view.timesheetStatus.toLowerCase().replace("_", " ")}{view.edits.length > 0 ? " · edited in payroll" : ""}</Badge>}
            </div>
            {view.edits.length > 0 && (
              <div className="rounded-md border border-[var(--warning-border)] bg-[var(--warning-soft)] px-3 py-2 text-sm">
                <p className="font-medium text-[var(--warning)]">Changed in payroll, so no longer what the timesheet first said{view.timesheetStatus === "CLIENT_APPROVED" ? " (and the client approved)" : ""}:</p>
                <ul className="mt-1.5 flex flex-wrap gap-2">
                  {view.edits.map((e) => (
                    <li key={e.date}>
                      <button type="button" className="rounded border border-[var(--warning-border)] bg-surface px-2 py-1 text-xs text-primary hover:bg-surface-hover" onClick={() => document.getElementById(`day-${e.date}`)?.scrollIntoView({ block: "center", behavior: "smooth" })} title="Go to this day">
                        <span className="font-medium">{e.date.slice(8)} {e.weekday}</span> · was {e.from}, now {e.to} · {e.by}, {e.at}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {view.mismatches.length > 0 && (
              <div className="rounded-md border border-[var(--warning-border)] bg-[var(--warning-soft)] px-3 py-2 text-sm">
                <p className="font-medium text-[var(--warning)]">Attendance and the client timesheet disagree on {view.mismatches.length} day{view.mismatches.length === 1 ? "" : "s"}:</p>
                <ul className="mt-1.5 flex flex-wrap gap-2">
                  {view.mismatches.map((m) => (
                    <li key={m.date}>
                      <button type="button" className="rounded border border-[var(--warning-border)] bg-surface px-2 py-1 text-xs text-primary hover:bg-surface-hover" onClick={() => document.getElementById(`day-${m.date}`)?.scrollIntoView({ block: "center", behavior: "smooth" })} title="Go to this day">
                        <span className="font-medium">{m.date.slice(8)} {m.weekday}</span> · attendance: {m.attendance} · sheet: {m.sheet}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {view.why && <p className="text-xs text-muted">{view.why}</p>}
            {view.hourly && view.editable && view.timesheetStatus && view.timesheetStatus !== "DRAFT" && <p className="text-xs text-muted">Changing an hour here changes the timesheet itself ({view.timesheetStatus.toLowerCase().replace("_", " ")}) and is recorded above, so the client&apos;s sheet and your payroll no longer agree. Tell the client if they need to re-approve it.</p>}

            <div className="max-h-[50vh] overflow-auto rounded-md border border-default">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-surface-subtle text-left text-xs font-medium uppercase tracking-wide text-muted">
                  <tr>
                    <th className="px-3 py-2">Date</th><th className="px-3 py-2">Status</th><th className="px-3 py-2 text-right">Hours</th><th className="px-3 py-2 text-right">Salary</th>
                    <th className="px-3 py-2 text-right">Overtime</th><th className="px-3 py-2 text-right">Absence</th>{showShort(view) && <th className="px-3 py-2 text-right">Short hours</th>}<th className="px-3 py-2 text-right">Day total</th>
                    <th className="px-3 py-2">Timesheet<Hint term="TIMESHEET" /></th><th className="px-3 py-2" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border)]">
                  {view.rows.map((r) => {
                    const off = r.kind === "off" || r.kind === "holiday" || r.kind === "outside";
                    return (
                      <tr key={r.date} id={`day-${r.date}`} className={cn(r.kind === "absent" && "bg-[var(--error-soft)]/40", r.sync === "differs" && r.kind !== "outside" && "bg-[var(--warning-soft)]/50", off && "text-muted")}>
                        <td className="whitespace-nowrap px-3 py-1.5 font-medium">{r.date.slice(8)} {r.weekday}</td>
                        <td className="px-3 py-1.5">
                          {editing === r.date ? (
                            <select className="input h-8 text-xs" value={draft.status} onChange={(e) => setDraft((d) => ({ ...d, status: e.target.value }))} aria-label="Status">
                              {STATUS_OPTIONS.filter(([v]) => !view.hourly || HOURLY_STATUS.has(v)).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                            </select>
                          ) : <span className={cn(r.kind === "absent" && "font-medium text-[var(--error)]", r.kind === "unrecorded" && "text-subtle")}>{r.label}</span>}
                        </td>
                        <td className="px-3 py-1.5 text-right tabular-nums">
                          {editing === r.date && draft.status === "PRESENT" ? (
                            <span className="inline-flex items-center gap-1">
                              <input className="input h-8 w-14 text-right text-xs" type="number" step="0.25" min="0" max="24" value={draft.normalHours} onChange={(e) => setDraft((d) => ({ ...d, normalHours: e.target.value }))} aria-label="Normal hours" />
                              {!view.hourly && <span className="text-xs text-muted">+</span>}
                              {!view.hourly && <input className="input h-8 w-14 text-right text-xs" type="number" step="0.25" min="0" max="24" value={draft.otHours} onChange={(e) => setDraft((d) => ({ ...d, otHours: e.target.value }))} aria-label="Overtime hours" />}
                            </span>
                          ) : r.hours > 0 ? <>{r.hours}{r.ot + r.rest > 0 && <span className="text-xs text-muted"> ({r.ot + r.rest} OT)</span>}</> : "—"}
                        </td>
                        <td className="px-3 py-1.5 text-right tabular-nums">{dash(r.salary)}</td>
                        <td className="px-3 py-1.5 text-right tabular-nums">{dash(r.otPay, "+")}</td>
                        <td className="px-3 py-1.5 text-right tabular-nums">{dash(r.deduction, "−")}</td>
                        {showShort(view) && (
                          <td className="whitespace-nowrap px-3 py-1.5 text-right text-xs tabular-nums">
                            {r.short ? (
                              <label className="inline-flex items-center justify-end gap-1.5" title={`Worked ${r.short.worked} h of a ${view.dailyHours} h day. Untick to not deduct for this day.`}>
                                <span className={r.short.counted ? "text-[var(--error)]" : "text-muted line-through"}>−{aed(r.short.suggested)}</span>
                                <span className="text-muted">({r.short.hours} h)</span>
                                {view.editable && <input type="checkbox" checked={r.short.counted} disabled={pending} onChange={(e) => toggleShort(r.date, e.target.checked)} aria-label={`Deduct short hours on ${r.date}`} />}
                              </label>
                            ) : "—"}
                          </td>
                        )}
                        <td className="px-3 py-1.5 text-right font-medium tabular-nums">{r.kind === "outside" ? "—" : aed(r.net)}</td>
                        <td className="px-3 py-1.5 text-xs">
                          {r.kind === "outside" || r.sync === "no-timesheet" ? <span className="text-subtle">{r.ts ?? "—"}</span> : r.sync === "match" ? <span className="text-[var(--success)]">{r.ts || "—"} ✓</span> : <span className="font-medium text-[var(--warning)]">Sheet: {r.ts || "blank"}</span>}
                        </td>
                        <td className="whitespace-nowrap px-3 py-1.5 text-right text-xs">
                          {editing === r.date ? (
                            <span className="inline-flex gap-2">
                              <button type="button" disabled={pending} className="font-medium text-[var(--brand-primary)] hover:underline" onClick={() => save(r.date)}>{pending ? "Saving…" : "Save"}</button>
                              <button type="button" className="text-muted hover:underline" onClick={() => setEditing(null)}>Cancel</button>
                            </span>
                          ) : view.editable && r.kind !== "outside" ? (
                            <span className="inline-flex gap-3">
                              <button type="button" className="font-medium text-[var(--brand-primary)] hover:underline" onClick={() => { setEditing(r.date); setDraft({ status: r.hasAttendance ? (STATUS_OPTIONS.find(([v]) => v === statusOf(r.label))?.[0] ?? "PRESENT") : "PRESENT", normalHours: r.hours > 0 ? String(r.hours - r.ot - r.rest) : "", otHours: r.ot + r.rest > 0 ? String(r.ot + r.rest) : "" }); }}>Edit</button>
                              {view.canAlign && r.sync === "differs" && r.ts && <button type="button" disabled={pending} className="font-medium text-[var(--warning)] hover:underline" onClick={() => align(r.date)}>Use timesheet</button>}
                            </span>
                          ) : null}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot className="border-t border-default bg-surface-subtle text-sm">
                  <tr><td className="px-3 py-2 font-medium" colSpan={3}>Total for the days</td><td className="px-3 py-2 text-right tabular-nums">{aed(view.totals.salary)}</td><td className="px-3 py-2 text-right tabular-nums">{dash(view.totals.otPay, "+")}</td><td className="px-3 py-2 text-right tabular-nums">{dash(view.totals.deduction, "−")}</td>{showShort(view) && <td className="px-3 py-2 text-right tabular-nums">{dash(view.totals.shortfall, "−")}</td>}<td className="px-3 py-2 text-right font-medium tabular-nums">{aed(view.totals.net)}</td><td colSpan={2} /></tr>
                  {view.parts.map((x, i) => (
                    <tr key={`${x.label}-${i}`}><td className="px-3 py-1.5 text-secondary" colSpan={showShort(view) ? 7 : 6}>{x.label}{x.note && <span className="ml-2 text-xs text-subtle">{x.note}</span>}</td><td className="px-3 py-1.5 text-right tabular-nums">{x.amount > 0 ? "+" : "−"}{aed(Math.abs(x.amount))}</td><td colSpan={2} /></tr>
                  ))}
                  {view.parts.length === 0 && view.unexplained === 0 && <tr><td className="px-3 py-1.5 text-secondary" colSpan={showShort(view) ? 7 : 6}>No gas charge, advances, deductions or adjustments</td><td className="px-3 py-1.5 text-right tabular-nums">—</td><td colSpan={2} /></tr>}
                  {view.unexplained !== 0 && (
                    <tr className="bg-[var(--warning-soft)]/50">
                      <td className="px-3 py-2 text-xs text-[var(--warning)]" colSpan={showShort(view) ? 7 : 6}>
                        The saved pay is out of date: it is {aed(Math.abs(view.unexplained))} {view.unexplained > 0 ? "above" : "below"} what these days add up to.
                        {view.canAdjust && <button type="button" disabled={pending} className="ml-2 font-medium underline" onClick={recalculate}>{pending ? "Recalculating…" : "Recalculate"}</button>}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums text-[var(--warning)]">{view.unexplained > 0 ? "+" : "−"}{aed(Math.abs(view.unexplained))}</td><td colSpan={2} />
                    </tr>
                  )}
                  <tr><td className="px-3 py-2 font-semibold text-primary" colSpan={showShort(view) ? 7 : 6}>Net pay</td><td className="px-3 py-2 text-right font-semibold tabular-nums text-primary">{aed(view.lineNet)}</td><td colSpan={2} /></tr>
                </tfoot>
              </table>
            </div>

            {adj && (
              <div className="rounded-md border border-default p-3">
                <h3 className="text-sm font-semibold text-primary">Deduction, advance and adjustment</h3>
                <p className="mb-2 text-xs text-muted">Typed against this person for this month. Each needs a note. Net pay updates when you save.</p>
                {view.canAdjust ? (
                  <div className="space-y-1.5">
                    {([["deduction", "Deduction", "What for? (fine, damage…)"], ["advance", "Advance", "Note (advance taken on…)"], ["adjustment", "Adjustment", "Bonus / correction (− to deduct)"]] as const).map(([k, label, ph]) => (
                      <label key={k} className="grid grid-cols-[6rem_8rem_1fr] items-center gap-2">
                        <span className="text-xs text-muted">{label}</span>
                        <input className="input h-8 text-right text-xs tabular-nums" type="number" step="0.01" value={adj[k]} onChange={setA(k)} aria-label={`${label} (AED)`} />
                        <input className="input h-8 text-xs" value={adj[`${k}Note` as const]} onChange={setA(`${k}Note` as const)} placeholder={ph} aria-label={`${label} note`} />
                      </label>
                    ))}
                    <div className="flex items-center gap-3 pt-1">
                      <button type="button" className="btn btn-primary h-8 px-3 text-xs" disabled={pending || !adjDirty} onClick={saveAdjustments}>{pending ? "Saving…" : "Save changes"}</button>
                      {saved && !adjDirty && <span className="text-xs text-[var(--success)]">Saved. Net pay is now AED {aed(view.lineNet)}.</span>}
                    </div>
                  </div>
                ) : <p className="text-xs text-muted">{view.why ?? "This run can't be changed any more."}</p>}
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

const statusOf = (label: string) => ({ Present: "PRESENT", Absent: "ABSENT", Leave: "LEAVE", Sick: "SICK_LEAVE", Idle: "IDLE", Holiday: "HOLIDAY", Off: "OFF" } as Record<string, string>)[label] ?? "PRESENT";

function Stat({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="rounded-md border border-default px-3 py-2">
      <p className="text-xs text-muted">{label}</p>
      <p className={cn("tabular-nums text-primary", strong ? "text-lg font-semibold" : "text-base font-medium")}>{value}</p>
    </div>
  );
}

const adjFrom = (v: PayDaysView) => ({ deduction: String(v.adjust.deduction || ""), deductionNote: v.adjust.deductionNote, advance: String(v.adjust.advance || ""), advanceNote: v.adjust.advanceNote, adjustment: String(v.adjust.adjustment || ""), adjustmentNote: v.adjust.adjustmentNote });
