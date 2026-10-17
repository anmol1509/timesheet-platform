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
  /** Tints the card and value. Reserve for real status, not decoration. */
  tone?: "default" | "warning" | "danger" | "success";
};

const TONE_TEXT: Record<NonNullable<KpiCell["tone"]>, string> = {
  default: "text-primary",
  warning: "text-[var(--warning)]",
  danger: "text-[var(--error)]",
  success: "text-primary",
};

/** Row of compact KPI cards: label, a large value, one line of context. Each opens the list it summarises. */
export function KpiStrip({ cells }: { cells: KpiCell[] }) {
  return (
    <div className={cn("grid grid-cols-2 gap-3 sm:gap-4", cells.length >= 4 ? "lg:grid-cols-4" : cells.length === 3 ? "lg:grid-cols-3" : "lg:grid-cols-2")}>
      {cells.map((cell) => {
        const tone = cell.tone ?? "default";
        return (
          <Link
            key={cell.label}
            href={cell.href}
            className={cn(
              "card relative flex flex-col px-4 py-3.5 transition hover:-translate-y-px hover:border-strong hover:shadow-md",
              tone === "danger" && "border-[var(--error-border)] bg-[linear-gradient(180deg,var(--error-soft),var(--surface)_70%)]",
              tone === "warning" && "border-[var(--warning-border)] bg-[linear-gradient(180deg,var(--warning-soft),var(--surface)_70%)]"
            )}
          >
            <span className="truncate text-[13px] font-medium text-muted">{cell.label}</span>
            <div
              className={cn(
                "tabular mt-1 font-semibold tracking-[-0.02em]",
                typeof cell.value === "string" && cell.value.length > 6 ? "text-[22px] leading-8" : "text-[28px] leading-9",
                TONE_TEXT[tone]
              )}
            >
              {typeof cell.value === "number" ? <AnimatedNumber value={cell.value} suffix={cell.suffix} /> : cell.value}
            </div>
            {cell.meter !== undefined && (
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[var(--surface-sunken)]">
                <div className="h-full rounded-full bg-[var(--brand-primary)]" style={{ width: `${Math.min(100, Math.max(0, cell.meter))}%` }} />
              </div>
            )}
            <span className="mt-1 text-xs text-subtle">{cell.sub}</span>
          </Link>
        );
      })}
    </div>
  );
}
