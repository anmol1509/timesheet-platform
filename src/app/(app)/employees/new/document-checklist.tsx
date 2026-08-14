"use client";

import { AlertTriangle, Check, Plus } from "lucide-react";
import { cn } from "@/lib/cn";

export type ChecklistItem = {
  key: string;
  label: string;
  /** Present = read from a document or typed in. */
  done: boolean;
  /** Shown under the label when present, e.g. the value that was read. */
  detail?: string | null;
  /** Something is wrong with the value even though it exists (e.g. expired). */
  warning?: string | null;
};

/**
 * What was read out of the uploaded files and what is still outstanding.
 *
 * Ticked items came from a document; missing ones get an amber prompt that
 * jumps to where they can be supplied, so gaps are obvious before the form is
 * submitted rather than after.
 */
export function DocumentChecklist({
  title,
  items,
  onFix,
  fixLabel = "Add",
  columns = 2,
}: {
  title: string;
  items: ChecklistItem[];
  /** Called with the item key when the amber prompt is used. */
  onFix?: (key: string) => void;
  fixLabel?: string;
  columns?: 1 | 2;
}) {
  const done = items.filter((i) => i.done).length;
  const complete = done === items.length;

  return (
    <section className="card overflow-hidden">
      <div className="card-header">
        <h3 className="text-sm font-semibold text-primary">{title}</h3>
        <span
          className={cn(
            "tabular rounded-md px-1.5 py-0.5 text-xs font-medium",
            complete
              ? "bg-[var(--success-soft)] text-[var(--success)]"
              : "bg-[var(--warning-soft)] text-[var(--warning)]"
          )}
        >
          {done}/{items.length}
        </span>
      </div>

      <ul className={cn("grid gap-x-4", columns === 2 && "sm:grid-cols-2")}>
        {items.map((item) => (
          <li
            key={item.key}
            className="flex items-start gap-2.5 border-b border-default px-4 py-2 last:border-b-0"
          >
            <span
              className={cn(
                "mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full",
                item.warning
                  ? "bg-[var(--warning-soft)] text-[var(--warning)]"
                  : item.done
                    ? "bg-[var(--success)] text-white"
                    : "border border-dashed border-[var(--warning)]"
              )}
            >
              {item.warning ? (
                <AlertTriangle className="h-2.5 w-2.5" aria-hidden />
              ) : item.done ? (
                <Check className="h-2.5 w-2.5" aria-hidden />
              ) : null}
            </span>

            <span className="min-w-0 flex-1">
              <span
                className={cn(
                  "block text-sm",
                  item.done ? "text-primary" : "text-muted"
                )}
              >
                {item.label}
              </span>
              {item.warning ? (
                <span className="block text-xs text-[var(--warning)]">
                  {item.warning}
                </span>
              ) : item.detail ? (
                <span className="tabular block truncate text-xs text-subtle">
                  {item.detail}
                </span>
              ) : null}
            </span>

            {!item.done && onFix && (
              <button
                type="button"
                onClick={() => onFix(item.key)}
                className="inline-flex shrink-0 items-center gap-1 rounded-control border border-[var(--warning-border)] bg-[var(--warning-soft)] px-2 py-1 text-xs font-medium text-[var(--warning)] transition hover:brightness-95"
              >
                <Plus className="h-3 w-3" aria-hidden />
                {fixLabel}
              </button>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
