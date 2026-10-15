"use client";

import { useId } from "react";
import type { LucideIcon } from "lucide-react";
import { ChevronDown, PanelTopClose, PanelTopOpen } from "lucide-react";
import { AnimatedNumber } from "@/components/motion";
import { useViewerPref } from "@/lib/useViewerPref";
import { cn } from "@/lib/cn";

export type SummaryItem = {
  /** Stable id passed back to `onSelect`. */
  key: string;
  label: string;
  value: number;
  icon: LucideIcon;
  /** Share of the whole, 0–100, shown beside the value. */
  share?: number;
  /** Reserve for real status: it colours the icon and value only when `value` is above zero. */
  tone?: "default" | "warning" | "danger";
};

const CHIP: Record<NonNullable<SummaryItem["tone"]>, string> = {
  default: "bg-brand-soft text-[var(--brand-primary)]",
  warning: "bg-[var(--warning-soft)] text-[var(--warning)]",
  danger: "bg-[var(--error-soft)] text-[var(--error)]",
};

const VALUE: Record<NonNullable<SummaryItem["tone"]>, string> = {
  default: "text-primary",
  warning: "text-[var(--warning)]",
  danger: "text-[var(--error)]",
};

const GRID_COLS: Record<number, string> = {
  2: "lg:grid-cols-2",
  3: "lg:grid-cols-3",
  4: "lg:grid-cols-4",
  5: "lg:grid-cols-5",
};

/**
 * The summary above a list: a single row of compact figures that are also the
 * list's quick filters, so the numbers and the filter chips are one control
 * instead of two copies of the same counts.
 *
 * Two looks, one component. Expanded (default, wide screens) shows compact
 * cards of about 60px; collapsed, and always on narrow screens, it shrinks to
 * a row of chips with the same counts. The filter never disappears, only the
 * decoration does. The choice is remembered per browser.
 *
 * Clicking the active item again returns to `allKey`.
 */
export function SummaryStrip({
  id,
  items,
  active,
  onSelect,
  allKey = "all",
  label = "Quick filters",
  className,
}: {
  /** Unique per list; keys the remembered open/closed choice. */
  id: string;
  items: SummaryItem[];
  active: string;
  onSelect: (key: string) => void;
  allKey?: string;
  label?: string;
  className?: string;
}) {
  const [pref, setPref] = useViewerPref(`ui.summary.${id}`);
  const expanded = pref !== "0";

  function pick(key: string) {
    onSelect(key === active && key !== allKey ? allKey : key);
  }

  const cols = GRID_COLS[items.length] ?? "lg:grid-cols-4";

  return (
    <div className={cn("flex items-start gap-2", className)}>
      <div className="min-w-0 flex-1" role="group" aria-label={label}>
        {expanded && (
          <div className={cn("hidden gap-3 lg:grid", cols)}>
            {items.map((item) => {
              const isActive = item.key === active;
              const tone = item.value > 0 ? (item.tone ?? "default") : "default";
              const Icon = item.icon;
              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => pick(item.key)}
                  aria-pressed={isActive}
                  className={cn(
                    "group flex items-center gap-3 rounded-card border px-3.5 py-2.5 text-left transition",
                    isActive
                      ? "border-[var(--brand-primary)] bg-brand-soft shadow-xs"
                      : "border-default bg-surface shadow-card hover:border-strong hover:shadow-sm"
                  )}
                >
                  <span className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px]", CHIP[tone])}>
                    <Icon className="h-4 w-4" aria-hidden />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-xs font-medium text-muted">{item.label}</span>
                    <span className="flex items-baseline gap-2">
                      <span className={cn("tabular text-[22px] leading-7 font-semibold tracking-[-0.02em]", VALUE[tone])}>
                        <AnimatedNumber value={item.value} />
                      </span>
                      {item.share !== undefined && (
                        <span className="tabular text-xs font-medium text-muted">{item.share}%</span>
                      )}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        )}

        <div className={cn("flex gap-1.5 overflow-x-auto pb-0.5", expanded && "lg:hidden")}>
          {items.map((item) => {
            const isActive = item.key === active;
            const tone = item.value > 0 ? (item.tone ?? "default") : "default";
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => pick(item.key)}
                aria-pressed={isActive}
                className={cn(
                  "inline-flex h-8 shrink-0 items-center gap-2 rounded-full border px-3 text-[13px] font-medium whitespace-nowrap transition",
                  isActive
                    ? "border-[var(--brand-primary)] bg-brand-soft text-[var(--brand-primary)]"
                    : "border-default bg-surface text-secondary hover:border-strong hover:text-primary"
                )}
              >
                {item.label}
                <span
                  className={cn(
                    "tabular rounded-full px-1.5 text-xs font-semibold",
                    isActive ? "bg-surface text-[var(--brand-primary)]" : "bg-surface-sunken",
                    !isActive && tone !== "default" && VALUE[tone]
                  )}
                >
                  {item.value.toLocaleString("en-GB")}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <button
        type="button"
        onClick={() => setPref(expanded ? "0" : "1")}
        aria-expanded={expanded}
        aria-label={expanded ? "Show filters as chips" : "Show summary cards"}
        title={expanded ? "Compact view" : "Show summary cards"}
        className="hidden h-8 w-8 shrink-0 items-center justify-center rounded-control text-subtle transition hover:bg-surface-hover hover:text-secondary lg:flex"
      >
        {expanded ? <PanelTopClose className="h-4 w-4" aria-hidden /> : <PanelTopOpen className="h-4 w-4" aria-hidden />}
      </button>
    </div>
  );
}

/**
 * A closed-by-default disclosure for the charts that belong with a list but
 * aren't what people open it for. Sits below the table; remembered per browser.
 */
export function Insights({
  id,
  title,
  hint,
  children,
}: {
  id: string;
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  const [pref, setPref] = useViewerPref(`ui.insights.${id}`);
  const open = pref === "1";
  const panelId = useId();

  return (
    <section className="card">
      <h2>
        <button
          type="button"
          onClick={() => setPref(open ? "0" : "1")}
          aria-expanded={open}
          aria-controls={panelId}
          className="flex w-full items-center gap-3 rounded-card px-5 py-3 text-left"
        >
          <span className="text-sm font-semibold text-primary">{title}</span>
          {hint && <span className="min-w-0 flex-1 truncate text-sm font-normal text-muted">{hint}</span>}
          <ChevronDown
            className={cn("ml-auto h-4 w-4 shrink-0 text-subtle transition-transform", open && "rotate-180")}
            aria-hidden
          />
        </button>
      </h2>
      <div id={panelId} hidden={!open}>
        {open && <div className="border-t border-default p-5">{children}</div>}
      </div>
    </section>
  );
}
