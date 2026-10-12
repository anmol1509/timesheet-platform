"use client";

import { m } from "motion/react";
import { CountUp } from "./CountUp";

const BUCKETS = [
  { label: "0–3 days", max: 3, tone: "bg-gradient-to-t from-[var(--success)] to-[var(--success)]/75" },
  { label: "4–7 days", max: 7, tone: "bg-gradient-to-t from-[var(--info)] to-[var(--info)]/75" },
  { label: "8–14 days", max: 14, tone: "bg-gradient-to-t from-[var(--warning)] to-[var(--warning)]/75" },
  { label: "15+ days", max: Infinity, tone: "bg-gradient-to-t from-[var(--error)] to-[var(--error)]/75" },
];

/** How long a queue of items has been waiting — bucketed by age so a pile-up
 * of old items is visible at a glance instead of buried in a sorted list. */
export function AgingHistogram({ ageDays, emptyMessage = "Nothing waiting." }: { ageDays: number[]; emptyMessage?: string }) {
  if (ageDays.length === 0) return <p className="text-sm text-muted">{emptyMessage}</p>;
  const counts = BUCKETS.map((b, i) => {
    const min = i === 0 ? -Infinity : BUCKETS[i - 1].max + 1;
    return ageDays.filter((d) => d > min - 1 && d <= b.max).length;
  });
  const max = Math.max(...counts, 1);
  return (
    <div className="flex h-32 items-end gap-4">
      {BUCKETS.map((b, i) => (
        <div key={b.label} className="group flex flex-1 flex-col items-center gap-1.5">
          {counts[i] > 0 && <CountUp value={counts[i]} className="tabular text-xs font-semibold text-primary" />}
          <m.span
            className={`w-full max-w-14 rounded-t-[4px] transition-[filter] duration-300 group-hover:brightness-110 ${b.tone}`}
            initial={{ height: 0 }}
            animate={{ height: Math.max(counts[i] > 0 ? 6 : 2, (counts[i] / max) * 88) }}
            transition={{ duration: 0.6, delay: i * 0.06, ease: [0.16, 1, 0.3, 1] }}
          />
          <span className="text-center text-[11px] text-subtle">{b.label}</span>
        </div>
      ))}
    </div>
  );
}
