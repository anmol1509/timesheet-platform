import { cn } from "@/lib/cn";

/** Slim progress bar with an optional "n / total" label, for list rows that show how far a record has got. */
export function ProgressBar({
  value,
  total,
  label,
  tone,
  className,
}: {
  value: number;
  total: number;
  /** Text beside the bar; defaults to "value / total". */
  label?: string;
  tone?: "success" | "warning" | "error" | "info";
  className?: string;
}) {
  const pct = total > 0 ? Math.min(100, Math.round((value / total) * 100)) : 0;
  const resolved = tone ?? (total > 0 && value >= total ? "success" : value > 0 ? "info" : "warning");
  return (
    <div className={cn("flex min-w-[120px] items-center gap-2", className)}>
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-sunken" role="progressbar" aria-valuenow={value} aria-valuemin={0} aria-valuemax={total}>
        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: `var(--${resolved})` }} />
      </div>
      <span className="tabular text-xs text-secondary whitespace-nowrap">{label ?? `${value} / ${total}`}</span>
    </div>
  );
}
