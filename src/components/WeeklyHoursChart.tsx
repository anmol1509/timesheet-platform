"use client";

import { m } from "motion/react";
import type { WeeklyHoursDay } from "@/lib/weeklyHours";

const HATCH_BG =
  "repeating-linear-gradient(135deg, #e2e8f0 0px, #e2e8f0 3px, transparent 3px, transparent 7px)";

export function WeeklyHoursChart({ days }: { days: WeeklyHoursDay[] }) {
  const max = Math.max(1, ...days.map((d) => d.hours));

  return (
    <div className="flex h-48 items-end justify-between gap-2 sm:gap-3">
      {days.map((d, i) => {
        const hasData = d.hours > 0;
        const heightPct = hasData ? Math.max(14, Math.round((d.hours / max) * 100)) : 55;
        return (
          <div key={i} className="flex flex-1 flex-col items-center gap-2">
            <div className="flex h-40 w-full items-end justify-center">
              <m.div
                title={hasData ? `${d.hours}h logged` : "No hours logged"}
                initial={{ height: 0 }}
                animate={{ height: `${heightPct}%` }}
                transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1], delay: i * 0.03 }}
                style={hasData ? undefined : { backgroundImage: HATCH_BG }}
                className={`w-full max-w-9 rounded-full ${
                  hasData ? "bg-[var(--brand-primary)]" : "border border-default"
                }`}
              />
            </div>
            <span className="text-xs font-medium text-subtle">{d.label}</span>
          </div>
        );
      })}
    </div>
  );
}
