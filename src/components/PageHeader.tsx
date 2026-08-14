import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/cn";

export type Crumb = { label: string; href?: string };

/**
 * Standard page masthead: optional breadcrumbs, title, one-line context, and a
 * right-aligned action slot. Replaces the ~59 hand-rolled title blocks so every
 * module opens with the same rhythm and the primary action always sits in the
 * same place.
 */
export function PageHeader({
  title,
  description,
  breadcrumbs,
  actions,
  meta,
  className,
}: {
  title: string;
  /** One short line of context. Omit rather than padding with filler. */
  description?: React.ReactNode;
  breadcrumbs?: Crumb[];
  /** Primary action last, so it lands closest to the page edge. */
  actions?: React.ReactNode;
  /** Badges/counts shown inline beside the title. */
  meta?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("space-y-3", className)}>
      {breadcrumbs && breadcrumbs.length > 0 && (
        <nav aria-label="Breadcrumb">
          <ol className="flex flex-wrap items-center gap-1 text-xs text-muted">
            {breadcrumbs.map((crumb, i) => (
              <li key={`${crumb.label}-${i}`} className="flex items-center gap-1">
                {i > 0 && (
                  <ChevronRight className="h-3 w-3 shrink-0 text-subtle" aria-hidden />
                )}
                {crumb.href ? (
                  <Link
                    href={crumb.href}
                    className="rounded-xs transition hover:text-primary"
                  >
                    {crumb.label}
                  </Link>
                ) : (
                  <span className="text-secondary">{crumb.label}</span>
                )}
              </li>
            ))}
          </ol>
        </nav>
      )}

      <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-xl font-semibold tracking-tight text-primary">
              {title}
            </h1>
            {meta}
          </div>
          {description && (
            <p className="mt-1 max-w-3xl text-sm text-muted">{description}</p>
          )}
        </div>
        {actions && (
          <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>
        )}
      </div>
    </div>
  );
}
