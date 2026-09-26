"use client";

import Link from "next/link";
import { m } from "motion/react";
import { cn } from "@/lib/cn";

export type BarListTone = "brand" | "info" | "success" | "warning" | "danger";

const BAR_GRADIENT: Record<BarListTone, string> = {
  brand: "bg-gradient-to-r from-[var(--brand-primary)] to-[var(--brand-primary)]/75",
  info: "bg-gradient-to-r from-[var(--info)] to-[var(--info)]/75",
  success: "bg-gradient-to-r from-[var(--success)] to-[var(--success)]/75",
  warning: "bg-gradient-to-r from-[var(--warning)] to-[var(--warning)]/75",
  danger: "bg-gradient-to-r from-[var(--error)] to-[var(--error)]/75",
};

export type BarListItem = {
  label: React.ReactNode;
  key: string;
  value: number;
  href?: string;
  /** Overrides the list-level `tone` for just this row — for severity-coded rows (e.g. occupancy level) inside an otherwise single-tone list. */
  tone?: BarListTone;
};

/**
 * Ranked horizontal bars — for "by trade", "by nationality", "by client":
 * categorical counts where the ranking is the point, which reads faster as
 * labelled bars than as a pie. `tone` colors the whole list (module-level
 * theming, so not every dashboard reads as the same purple); a row's own
 * `tone` wins when the bar encodes severity instead (e.g. camp occupancy).
 */
export function BarList({
  items,
  emptyLabel = "No data yet.",
  format = String,
  tone = "brand",
  showShare = true,
}: {
  items: BarListItem[];
  emptyLabel?: string;
  format?: (n: number) => string;
  tone?: BarListTone;
  /** Hides the "% of total" badge — turn off when `value` is already a rate/percentage rather than a count that sums to a meaningful whole (e.g. per-camp occupancy). */
  showShare?: boolean;
}) {
  if (items.length === 0) return <p className="py-6 text-center text-sm text-muted">{emptyLabel}</p>;
  const max = Math.max(...items.map((i) => i.value), 1);
  const total = items.reduce((n, i) => n + i.value, 0);
  return (
    <ul className="space-y-2.5">
      {items.map((item, i) => {
        const row = (
          <>
            <div className="mb-1 flex items-baseline justify-between gap-3 text-sm">
              <span className="min-w-0 truncate text-secondary">{item.label}</span>
              <span className="tabular shrink-0 font-semibold text-primary">
                {format(item.value)}
                {showShare && <span className="ml-1.5 text-xs font-normal text-subtle">{Math.round((item.value / total) * 100)}%</span>}
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-surface-sunken">
              <m.div
                className={cn("h-full rounded-full transition-[filter] duration-300 group-hover:brightness-110", BAR_GRADIENT[item.tone ?? tone])}
                initial={{ width: "0%" }}
                animate={{ width: `${(item.value / max) * 100}%` }}
                transition={{ duration: 0.6, delay: i * 0.035, ease: [0.16, 1, 0.3, 1] }}
              />
            </div>
          </>
        );
        return (
          <li key={item.key}>
            {item.href ? (
              <Link href={item.href} className="group -mx-2 block rounded-lg px-2 py-1 transition hover:bg-surface-hover">{row}</Link>
            ) : (
              <div className="group py-1">{row}</div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
