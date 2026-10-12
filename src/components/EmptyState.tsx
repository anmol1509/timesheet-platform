import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/cn";

/**
 * Empty state. Answers what happened → why it matters → what to do next,
 * in that order. `title` states the situation, `description` gives the reason
 * to care, `action` is the way out.
 */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  secondaryAction,
  size = "default",
  className,
}: {
  icon?: LucideIcon;
  title: string;
  description?: React.ReactNode;
  action?: React.ReactNode;
  secondaryAction?: React.ReactNode;
  /** `compact` for empty states nested inside a card or tab pane. */
  size?: "default" | "compact";
  className?: string;
}) {
  return (
    <div
      className={cn(
        "empty-state flex flex-col items-center",
        size === "compact" && "px-4 py-8",
        className
      )}
    >
      {Icon && (
        <span
          className={cn(
            "mb-4 flex items-center justify-center rounded-2xl bg-surface text-[var(--brand-primary)] shadow-sm ring-1 ring-[var(--brand-primary-border)]",
            size === "compact" ? "h-10 w-10" : "h-12 w-12"
          )}
        >
          <Icon className={size === "compact" ? "h-4.5 w-4.5" : "h-5.5 w-5.5"} aria-hidden />
        </span>
      )}
      <p className="text-[15px] font-semibold tracking-tight text-primary">{title}</p>
      {description && (
        <p className="mt-1 max-w-sm text-sm text-muted">{description}</p>
      )}
      {(action || secondaryAction) && (
        <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
          {action}
          {secondaryAction}
        </div>
      )}
    </div>
  );
}
