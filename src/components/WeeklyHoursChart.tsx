"use client";

import { m } from "motion/react";
import type { WeeklyHoursDay } from "@/lib/weeklyHours";

/**
 * Days with no hours render as a hairline tick, not a placeholder bar — an
 * empty day should look like nothing, not like the tallest thing on the chart.
 * The busiest day is the only one in full brand colour.
 */
export function WeeklyHoursChart({ days }: { days: WeeklyHoursDay[] }) {
  const max = Math.max(1, ...days.map((d) => d.hours));
  const peak = days.reduce((best, d) => (d.hours > best.hours ? d : best), days[0]);

  return (
    <div className="flex h-44 items-end justify-between gap-3">
      {days.map((d, i) => {
        const hasData = d.hours > 0;
        const isPeak = hasData && d === peak;
        return (
          <div key={i} className="flex flex-1 flex-col items-center gap-2">
            <div className="flex h-36 w-full flex-col items-center justify-end gap-1.5">
              {hasData && (
                <span className="tabular text-[11px] font-medium text-secondary">{d.hours}</span>
              )}
              <m.div
                title={hasData ? `${d.hours}h logged` : "No hours logged"}
                initial={{ height: 0 }}
                animate={{ height: hasData ? `${Math.max(8, Math.round((d.hours / max) * 100))}%` : 2 }}
                transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1], delay: i * 0.03 }}
                className={`w-full max-w-7 rounded-t-[4px] ${
                  isPeak
                    ? "bg-[var(--brand-primary)]"
                    : hasData
                      ? "bg-[var(--brand-primary)]/35"
                      : "bg-[var(--border-strong)]"
                }`}
              />
            </div>
            <span className={`text-xs ${isPeak ? "font-semibold text-primary" : "text-subtle"}`}>
              {d.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}
