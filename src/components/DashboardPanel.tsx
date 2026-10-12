import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/cn";

/** Card wrapper for dashboard widgets — title bar, optional link, body. */
export function Panel({
  title,
  icon: Icon,
  href,
  linkLabel = "View all",
  children,
  className,
  bodyClassName,
}: {
  title: string;
  icon?: React.ComponentType<{ className?: string }>;
  href?: string;
  linkLabel?: string;
  children: React.ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <section className={cn("card flex flex-col", className)}>
      <div className="card-header">
        <h2 className="flex items-center gap-2.5 text-[15px] font-semibold tracking-tight text-primary">
          {Icon && (
            <span className="icon-chip h-7 w-7 rounded-lg">
              <Icon className="h-3.5 w-3.5" />
            </span>
          )}
          {title}
        </h2>
        {href && (
          <Link
            href={href}
            className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-[var(--brand-primary)] transition hover:underline"
          >
            {linkLabel}
            <ArrowRight className="h-3 w-3" aria-hidden />
          </Link>
        )}
      </div>
      <div className={cn("flex-1 p-5", bodyClassName)}>{children}</div>
    </section>
  );
}

export function QuickAction({
  href,
  icon: Icon,
  label,
  sub,
}: {
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  sub: string;
}) {
  return (
    <Link
      href={href}
      className="group card flex items-center gap-3 p-3.5 transition hover:-translate-y-px hover:border-[var(--brand-primary-border)] hover:shadow-md"
    >
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-brand-soft text-[var(--brand-primary)] transition group-hover:bg-[var(--brand-primary)] group-hover:text-white">
        <Icon className="h-4 w-4" />
      </span>
      <span className="min-w-0">
        <span className="block truncate text-sm font-medium text-primary">{label}</span>
        <span className="block truncate text-xs text-muted">{sub}</span>
      </span>
    </Link>
  );
}
