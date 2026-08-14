import { cn } from "@/lib/cn";

// Soft fill + matching text, with a hairline border so badges keep their shape
// against both white cards and tinted table rows.
const COLORS = {
  green:
    "bg-[var(--success-soft)] text-[var(--success)] ring-1 ring-[var(--success-border)]",
  amber:
    "bg-[var(--warning-soft)] text-[var(--warning)] ring-1 ring-[var(--warning-border)]",
  red: "bg-[var(--error-soft)] text-[var(--error)] ring-1 ring-[var(--error-border)]",
  blue: "bg-[var(--info-soft)] text-[var(--info)] ring-1 ring-[var(--info-border)]",
  slate: "bg-surface-sunken text-secondary ring-1 ring-[var(--border)]",
  navy: "bg-brand-soft text-[var(--brand-primary)] ring-1 ring-[var(--brand-primary-border)]",
} as const;

export type BadgeColor = keyof typeof COLORS;

export function Badge({
  children,
  color = "slate",
  /** Leading status dot — useful when the same column carries several states. */
  dot = false,
  className,
}: {
  children: React.ReactNode;
  color?: BadgeColor;
  dot?: boolean;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md px-1.5 py-0.5 text-xs font-medium whitespace-nowrap",
        COLORS[color],
        className
      )}
    >
      {dot && (
        <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-current" aria-hidden />
      )}
      {children}
    </span>
  );
}
