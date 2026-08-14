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
            "mb-3 flex items-center justify-center rounded-full bg-surface-sunken text-subtle",
            size === "compact" ? "h-9 w-9" : "h-11 w-11"
          )}
        >
          <Icon className={size === "compact" ? "h-4 w-4" : "h-5 w-5"} aria-hidden />
        </span>
      )}
      <p className="text-sm font-medium text-primary">{title}</p>
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
