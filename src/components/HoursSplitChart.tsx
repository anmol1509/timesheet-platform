"use client";

import { Clock } from "lucide-react";
import { m } from "motion/react";
import type { HoursSplit } from "@/lib/attendanceHours";

/** A round axis ceiling (10, 20, 50, 100, 200…) at or above `max`. */
function niceCeil(max: number) {
  if (max <= 0) return 10;
  const pow = 10 ** Math.floor(Math.log10(max));
  const step = [1, 2, 2.5, 5, 10].find((s) => s * pow >= max) ?? 10;
  return step * pow;
}

function shortDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
}

/**
 * Normal vs overtime hours per day, stacked. Overtime sits on top in the
 * warning tone because a tall amber cap is the thing worth noticing — the
 * question this answers is "where is overtime accumulating", not "how many
 * hours did we log".
 */
export function HoursSplitChart({ split }: { split: HoursSplit }) {
  if (split.days.length === 0) {
    return (
      <div className="flex flex-col items-center px-5 py-10 text-center">
        <span className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-brand-soft text-[var(--brand-primary)]">
          <Clock className="h-5 w-5" aria-hidden />
        </span>
        <p className="text-sm font-medium text-primary">No attendance recorded yet</p>
        <p className="mt-1 text-xs text-muted">
          Mark daily attendance and the normal-versus-overtime split appears here.
        </p>
      </div>
    );
  }

  const max = niceCeil(Math.max(...split.days.map((d) => d.normal + d.ot)));
  const ticks = [1, 0.75, 0.5, 0.25, 0].map((f) => Math.round(max * f));

  return (
    <div className="flex h-full flex-col gap-4">
      <div className="flex flex-wrap items-end gap-x-4 gap-y-2">
        <span className="tabular text-[32px] leading-none font-semibold tracking-[-0.02em] text-primary">
          {split.totalNormal + split.totalOt}h
        </span>
        <span className="text-xs text-muted">
          <span className="font-semibold text-secondary">{split.totalNormal}h</span> normal ·{" "}
          <span className="font-semibold text-[var(--warning)]">{split.totalOt}h</span> overtime
        </span>
        <div className="ml-auto flex items-center gap-3 text-xs text-muted">
          <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-[var(--brand-primary)]" />Normal</span>
          <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-[var(--warning)]" />Overtime</span>
          {split.periodLabel && <span className="hidden text-subtle sm:inline">{split.periodLabel}</span>}
        </div>
      </div>

      <div className="flex min-h-44 flex-1 gap-2">
        {/* Y axis */}
        <div className="flex flex-col justify-between pb-0 text-right">
          {ticks.map((t) => (
            <span key={t} className="tabular -translate-y-1/2 text-[10px] leading-none text-subtle first:translate-y-0 last:translate-y-0">{t}</span>
          ))}
        </div>
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="relative flex-1">
            {/* Gridlines */}
            <div className="pointer-events-none absolute inset-0 flex flex-col justify-between" aria-hidden>
              {ticks.map((t, i) => (
                <span key={t} className={i === ticks.length - 1 ? "h-px bg-[var(--border-strong)]" : "h-px border-t border-dashed border-[var(--border)]"} />
              ))}
            </div>
            <div className="relative flex h-full items-end gap-1 sm:gap-1.5">
              {split.days.map((day) => {
                const total = day.normal + day.ot;
                const heightPct = (total / max) * 100;
                return (
                  <div key={day.date} className="group relative flex h-full min-w-0 flex-1 items-end justify-center">
                    {total > 0 ? (
                      <m.div
                        className="flex w-full max-w-8 flex-col-reverse overflow-hidden rounded-t-[4px] transition-[filter] group-hover:brightness-110"
                        initial={{ height: "0%" }}
                        animate={{ height: `${Math.max(3, heightPct)}%` }}
                        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                      >
                        <span className="w-full bg-[var(--brand-primary)]" style={{ height: `${(day.normal / total) * 100}%` }} />
                        <span className="w-full bg-[var(--warning)]" style={{ height: `${(day.ot / total) * 100}%` }} />
                      </m.div>
                    ) : (
                      <div className="h-0.5 w-full max-w-8 rounded-full bg-[var(--border)]" />
                    )}
                    {/* Tooltip */}
                    <div className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-2 hidden -translate-x-1/2 rounded-lg bg-[var(--tooltip-bg)] px-2.5 py-1.5 text-[11px] whitespace-nowrap text-[var(--tooltip-text)] shadow-lg group-hover:block">
                      <p className="font-semibold">{day.label} {shortDate(day.date)}</p>
                      <p className="tabular opacity-90">{day.normal}h normal · {day.ot}h OT</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          <div className="mt-2 flex gap-1 sm:gap-1.5">
            {split.days.map((day, i) => (
              <span key={day.date} className="min-w-0 flex-1 truncate text-center text-[10px] text-subtle">
                {/* Every other label on narrow screens so 14 dates never collide. */}
                <span className={i % 2 === 1 ? "hidden sm:inline" : undefined}>{shortDate(day.date)}</span>
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
