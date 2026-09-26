import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { ArrowRight, TrendingDown, TrendingUp } from "lucide-react";
import { cn } from "@/lib/cn";
import { AnimatedNumber } from "@/components/motion";

export type StatTileTrend = {
  /** Signed change; sign drives the arrow and colour. */
  direction: "up" | "down";
  /** Pre-formatted change, e.g. "+12%" or "3 fewer". */
  label: string;
  /** What the change is measured against, e.g. "vs last month". */
  comparison?: string;
  /** Set when a rise is bad (e.g. expiring documents) so colour reads correctly. */
  inverted?: boolean;
};

/**
 * KPI tile. Hierarchy is label → value → trend → comparison, with the value
 * carrying nearly all the visual weight. Tiles are deliberately quiet: colour
 * is reserved for the `warning` tone and for trend direction, so a wall of
 * them still scans.
 */
export function StatTile({
  label,
  value,
  icon: Icon,
  hint,
  trend,
  tone = "default",
  hero = false,
  href,
}: {
  label: string;
  value: React.ReactNode;
  icon?: LucideIcon;
  hint?: string;
  trend?: StatTileTrend;
  tone?: "default" | "warning";
  /** Emphasised treatment — reserve for a single standout tile per screen. */
  hero?: boolean;
  /** When set, the whole tile links there — used to jump to the source page. */
  href?: string;
}) {
  const isWarning = tone === "warning";
  // Numbers (and "N%" strings, the one other shape every call site passes)
  // count up on mount/change instead of just appearing — everything else
  // (already-composed nodes) passes through untouched.
  const percentMatch = typeof value === "string" ? value.match(/^(\d+)%$/) : null;
  const animatedValue =
    typeof value === "number" ? (
      <AnimatedNumber value={value} />
    ) : percentMatch ? (
      <AnimatedNumber value={Number(percentMatch[1])} suffix="%" />
    ) : (
      value
    );
  const trendPositive = trend
    ? trend.inverted
      ? trend.direction === "down"
      : trend.direction === "up"
    : false;

  const content = (
    <>
      <div className="flex items-center gap-2.5">
        {Icon && (
          <span
            className={cn(
              "flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px]",
              hero
                ? "bg-white/15 text-white"
                : isWarning
                  ? "bg-[var(--surface)] text-[var(--warning)] ring-1 ring-[var(--warning-border)]"
                  : "bg-brand-soft text-[var(--brand-primary)]"
            )}
          >
            <Icon className="h-4 w-4" aria-hidden />
          </span>
        )}
        <span
          className={cn(
            "min-w-0 flex-1 truncate text-[13px] font-medium",
            hero ? "text-white/80" : isWarning ? "text-[var(--warning)]" : "text-muted"
          )}
        >
          {label}
        </span>
        {href && (
          <ArrowRight
            className={cn(
              "h-4 w-4 shrink-0 opacity-0 transition group-hover:translate-x-0.5 group-hover:opacity-100",
              hero ? "text-white" : "text-subtle"
            )}
            aria-hidden
          />
        )}
      </div>

      <div
        className={cn(
          "tabular mt-3 text-[30px] leading-9 font-semibold tracking-[-0.02em]",
          hero ? "text-white" : isWarning ? "text-[var(--warning)]" : "text-primary"
        )}
      >
        {animatedValue}
      </div>

      {(trend || hint) && (
        <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1">
          {trend && (
            <span
              className={cn(
                "inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[11px] font-semibold",
                hero
                  ? "bg-white/15 text-white"
                  : trendPositive
                    ? "bg-[var(--success-soft)] text-[var(--success)]"
                    : "bg-[var(--error-soft)] text-[var(--error)]"
              )}
            >
              {trend.direction === "up" ? (
                <TrendingUp className="h-3 w-3" />
              ) : (
                <TrendingDown className="h-3 w-3" />
              )}
              {trend.label}
            </span>
          )}
          {(trend?.comparison || hint) && (
            <span className={cn("text-xs", hero ? "text-white/70" : "text-subtle")}>
              {trend?.comparison ?? hint}
            </span>
          )}
        </div>
      )}
    </>
  );

  const className = cn(
    "group block rounded-card border p-4 shadow-card",
    hero
      ? "border-transparent bg-[image:var(--brand-gradient)] text-white shadow-[var(--shadow-brand)]"
      : isWarning
        ? "border-[var(--warning-border)] bg-[var(--warning-soft)]"
        : "border-default bg-surface",
    href && "transition hover:-translate-y-px hover:border-strong hover:shadow-md",
    href && hero && "hover:brightness-110"
  );

  return href ? (
    <Link href={href} className={className}>
      {content}
    </Link>
  ) : (
    <div className={className}>{content}</div>
  );
}
