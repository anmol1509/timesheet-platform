import Link from "next/link";
import { cn } from "@/lib/cn";

export type BarListTone = "brand" | "info" | "success" | "warning" | "danger";

const BAR_COLOR: Record<BarListTone, string> = {
  brand: "bg-[var(--brand-primary)]",
  info: "bg-[var(--info)]",
  success: "bg-[var(--success)]",
  warning: "bg-[var(--warning)]",
  danger: "bg-[var(--error)]",
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
      {items.map((item) => {
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
              <div
                className={cn("h-full rounded-full transition-[width] duration-500", BAR_COLOR[item.tone ?? tone])}
                style={{ width: `${(item.value / max) * 100}%` }}
              />
            </div>
          </>
        );
        return (
          <li key={item.key}>
            {item.href ? (
              <Link href={item.href} className="-mx-2 block rounded-lg px-2 py-1 transition hover:bg-surface-hover">{row}</Link>
            ) : (
              <div className="py-1">{row}</div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
