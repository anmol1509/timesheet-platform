import Link from "next/link";
import { cn } from "@/lib/cn";
import { AnimatedNumber } from "@/components/motion";

export type KpiCell = {
  label: string;
  /** Numbers count up; strings ("AED 1,200", "3/10") render as given. */
  value: number | string;
  suffix?: string;
  sub: string;
  href: string;
  /** 0–100; renders a thin progress meter under the value. */
  meter?: number;
  /** Colours the value and a status dot. Reserve for real status, not decoration. */
  tone?: "default" | "warning" | "danger" | "success";
};

const TONE_TEXT: Record<NonNullable<KpiCell["tone"]>, string> = {
  default: "text-primary",
  warning: "text-[var(--warning)]",
  danger: "text-[var(--error)]",
  success: "text-primary",
};

const TONE_DOT: Record<NonNullable<KpiCell["tone"]>, string> = {
  default: "",
  warning: "bg-[var(--warning)]",
  danger: "bg-[var(--error)]",
  success: "bg-[var(--success)]",
};

/**
 * One card, divided into cells, instead of four separate boxes: the strip reads
 * as a single summary line rather than four competing tiles. The first cell is
 * the anchor — it gets the larger value.
 */
export function KpiStrip({ cells }: { cells: KpiCell[] }) {
  return (
    <div className="card grid grid-cols-2 divide-x divide-y divide-[var(--border)] overflow-hidden lg:grid-cols-4 lg:divide-y-0">
      {cells.map((cell, i) => {
        const tone = cell.tone ?? "default";
        return (
          <Link
            key={cell.label}
            href={cell.href}
            className="group relative block p-5 transition hover:bg-surface-hover"
          >
            <div className="flex items-center gap-2 text-[13px] font-medium text-muted">
              {TONE_DOT[tone] && (
                <span className={cn("h-1.5 w-1.5 rounded-full", TONE_DOT[tone])} aria-hidden />
              )}
              {cell.label}
            </div>
            <div
              className={cn(
                "tabular mt-2 font-semibold tracking-tight",
                typeof cell.value === "string" && cell.value.length > 6
                  ? "text-[26px] leading-10"
                  : i === 0
                    ? "text-[36px] leading-10"
                    : "text-[32px] leading-10",
                TONE_TEXT[tone]
              )}
            >
              {typeof cell.value === "number" ? (
                <AnimatedNumber value={cell.value} suffix={cell.suffix} />
              ) : (
                cell.value
              )}
            </div>
            {cell.meter !== undefined && (
              <div className="mt-3 h-1 overflow-hidden rounded-full bg-[var(--surface-sunken)]">
                <div
                  className="h-full rounded-full bg-[var(--brand-primary)]"
                  style={{ width: `${Math.min(100, Math.max(0, cell.meter))}%` }}
                />
              </div>
            )}
            <div className={cn("text-xs text-subtle", cell.meter !== undefined ? "mt-2" : "mt-3")}>
              {cell.sub}
            </div>
          </Link>
        );
      })}
    </div>
  );
}
