import { cn } from "@/lib/cn";

// Codifies the card wrapper repeated around every grouped block of fields in
// edit-form.tsx files. Long ERP forms are broken into these rather than one
// undifferentiated wall of inputs.
export function Section({
  title,
  description,
  actions,
  children,
  /** Render children as-is instead of in the two-column field grid. */
  plain,
  className,
}: {
  title?: string;
  /** One line explaining what belongs in this group, where it isn't obvious. */
  description?: React.ReactNode;
  /** Section-level control, e.g. an "Add row" button. */
  actions?: React.ReactNode;
  children: React.ReactNode;
  plain?: boolean;
  className?: string;
}) {
  return (
    <section className={cn("card", className)}>
      {(title || actions) && (
        <div className="card-header">
          <div className="min-w-0">
            {title && (
              <h2 className="text-sm font-semibold text-primary">{title}</h2>
            )}
            {description && (
              <p className="mt-0.5 text-xs text-muted">{description}</p>
            )}
          </div>
          {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
        </div>
      )}
      <div className="p-5">
        {plain ? (
          children
        ) : (
          <div className="grid grid-cols-1 gap-x-4 gap-y-4 sm:grid-cols-2">
            {children}
          </div>
        )}
      </div>
    </section>
  );
}
