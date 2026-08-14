import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { ArrowRight, TrendingDown, TrendingUp } from "lucide-react";
import { cn } from "@/lib/cn";

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
  const trendPositive = trend
    ? trend.inverted
      ? trend.direction === "down"
      : trend.direction === "up"
    : false;

  const content = (
    <>
      <div className="flex items-start justify-between gap-3">
        <span
          className={cn(
            "text-xs font-medium tracking-wide uppercase",
            hero ? "text-blue-100" : isWarning ? "text-[var(--warning)]" : "text-muted"
          )}
        >
          {label}
        </span>
        {Icon && (
          <Icon
            className={cn(
              "h-4 w-4 shrink-0",
              hero ? "text-blue-100" : isWarning ? "text-[var(--warning)]" : "text-subtle"
            )}
          />
        )}
        {href && !Icon && (
          <ArrowRight
            className={cn(
              "h-4 w-4 shrink-0 transition-transform group-hover:translate-x-0.5",
              hero ? "text-blue-100" : "text-subtle"
            )}
          />
        )}
      </div>

      <div
        className={cn(
          "tabular mt-2 text-[28px] leading-9 font-semibold tracking-tight",
          hero ? "text-white" : "text-primary"
        )}
      >
        {value}
      </div>

      {(trend || hint) && (
        <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1">
          {trend && (
            <span
              className={cn(
                "inline-flex items-center gap-1 text-xs font-medium",
                hero
                  ? "text-white"
                  : trendPositive
                    ? "text-[var(--success)]"
                    : "text-[var(--error)]"
              )}
            >
              {trend.direction === "up" ? (
                <TrendingUp className="h-3.5 w-3.5" />
              ) : (
                <TrendingDown className="h-3.5 w-3.5" />
              )}
              {trend.label}
            </span>
          )}
          {(trend?.comparison || hint) && (
            <span className={cn("text-xs", hero ? "text-blue-100" : "text-subtle")}>
              {trend?.comparison ?? hint}
            </span>
          )}
        </div>
      )}
    </>
  );

  const className = cn(
    "group block rounded-card border p-4",
    hero
      ? "border-transparent bg-gradient-to-br from-blue-600 to-[var(--brand-navy)] text-white"
      : isWarning
        ? "border-[var(--warning-border)] bg-[var(--warning-soft)]"
        : "border-default bg-surface",
    href && "transition hover:border-strong hover:shadow-sm",
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
