"use client";

import { Clock } from "lucide-react";
import { m } from "motion/react";
import type { HoursSplit } from "@/lib/attendanceHours";

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
        <Clock className="mb-2 h-5 w-5 text-subtle" aria-hidden />
        <p className="text-sm font-medium text-primary">No attendance recorded yet</p>
        <p className="mt-1 text-xs text-muted">
          Mark daily attendance and the normal-versus-overtime split appears here.
        </p>
      </div>
    );
  }

  const max = Math.max(...split.days.map((d) => d.normal + d.ot));

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
        <span className="tabular text-2xl font-semibold text-primary">
          {split.totalNormal + split.totalOt}h
        </span>
        <span className="text-xs text-muted">
          <span className="font-medium text-secondary">{split.totalNormal}h</span> normal ·{" "}
          <span className="font-medium text-[var(--warning)]">{split.totalOt}h</span> overtime
        </span>
        {split.periodLabel && (
          <span className="ml-auto text-xs text-subtle">{split.periodLabel}</span>
        )}
      </div>

      <div className="flex h-40 items-end gap-1">
        {split.days.map((day) => {
          const total = day.normal + day.ot;
          const heightPct = max > 0 ? (total / max) * 100 : 0;
          return (
            <div key={day.date} className="flex min-w-0 flex-1 flex-col items-center gap-1.5">
              <div className="flex w-full flex-1 items-end justify-center">
                {total > 0 ? (
                  <m.div
                    className="flex w-full max-w-7 flex-col-reverse overflow-hidden rounded-t-sm"
                    initial={{ height: 0 }}
                    animate={{ height: `${Math.max(4, heightPct)}%` }}
                    transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                    title={`${day.label} — ${day.normal}h normal, ${day.ot}h overtime`}
                  >
                    <span
                      className="w-full bg-[var(--brand-primary)]"
                      style={{ height: `${(day.normal / total) * 100}%` }}
                    />
                    <span
                      className="w-full bg-[var(--warning)]"
                      style={{ height: `${(day.ot / total) * 100}%` }}
                    />
                  </m.div>
                ) : (
                  <div
                    className="h-0.5 w-full max-w-7 rounded-full bg-[var(--border)]"
                    title={`${day.label} — no hours`}
                  />
                )}
              </div>
              <span className="w-full truncate text-center text-[10px] text-subtle">
                {day.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
