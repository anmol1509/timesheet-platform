"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight, Home } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/cn";
import { getNavPages } from "@/app/(platform)/(app)/nav-links";

export type Crumb = { label: string; href?: string };

const looksLikeId = (seg: string) => /\d/.test(seg) && seg.length >= 6;
const prettify = (seg: string) => seg.replace(/[-_]+/g, " ").replace(/^./, (c) => c.toUpperCase());

/**
 * Breadcrumbs for a page that doesn't set its own: the sidebar section and page it lives under, any detail level in
 * between, then the page itself. Top-level pages (the sidebar entry itself) get none.
 */
function autoCrumbs(pathname: string, title: string): Crumb[] {
  const pages = getNavPages(true, true);
  let best: (typeof pages)[number] | null = null;
  for (const p of pages) {
    if (p.href === "/") continue;
    if ((pathname === p.href || pathname.startsWith(p.href + "/")) && (!best || p.href.length > best.href.length)) best = p;
  }
  if (!best || pathname === best.href) return [];
  const crumbs: Crumb[] = [];
  if (best.group !== best.label) crumbs.push({ label: best.group });
  crumbs.push({ label: best.label, href: best.href });
  const rest = pathname.slice(best.href.length).split("/").filter(Boolean);
  let prefix = best.href;
  rest.slice(0, -1).forEach((seg) => {
    prefix += "/" + seg;
    crumbs.push(looksLikeId(seg) ? { label: "Details", href: prefix } : { label: prettify(seg) });
  });
  crumbs.push({ label: title });
  return crumbs;
}

/**
 * Standard page masthead: optional breadcrumbs, title, one-line context, and a
 * right-aligned action slot, so every module opens with the same rhythm and
 * the primary action always sits in the same place.
 */
export function PageHeader({
  title,
  description,
  breadcrumbs,
  actions,
  meta,
  icon: Icon,
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
  /** Module icon shown in a tinted chip beside the title. */
  icon?: LucideIcon;
  className?: string;
}) {
  const pathname = usePathname();
  breadcrumbs = breadcrumbs ?? autoCrumbs(pathname, title);
  return (
    <div className={cn("space-y-3", className)}>
      {breadcrumbs && breadcrumbs.length > 0 && (
        <nav aria-label="Breadcrumb">
          <ol className="flex flex-wrap items-center gap-1.5 text-xs text-muted">
            <li className="flex items-center">
              <Link href="/" aria-label="Dashboard" className="rounded-xs p-0.5 transition hover:text-primary">
                <Home className="h-3.5 w-3.5" aria-hidden />
              </Link>
            </li>
            {breadcrumbs.map((crumb, i) => (
              <li key={`${crumb.label}-${i}`} className="flex items-center gap-1.5">
                <ChevronRight className="h-3 w-3 shrink-0 text-subtle" aria-hidden />
                {crumb.href ? (
                  <Link href={crumb.href} className="rounded-xs font-medium transition hover:text-primary">
                    {crumb.label}
                  </Link>
                ) : (
                  <span className="font-medium text-secondary">{crumb.label}</span>
                )}
              </li>
            ))}
          </ol>
        </nav>
      )}

      <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
        <div className="flex min-w-0 items-start gap-3">
          {Icon && (
            <span className="icon-chip mt-0.5 h-10 w-10 rounded-xl">
              <Icon className="h-5 w-5" aria-hidden />
            </span>
          )}
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="text-page-title text-primary">{title}</h1>
              {meta}
            </div>
            {description && (
              <p className="mt-1 max-w-3xl text-sm leading-relaxed text-muted">{description}</p>
            )}
          </div>
        </div>
        {actions && (
          <div className="flex max-w-full shrink-0 flex-wrap items-center gap-2">{actions}</div>
        )}
      </div>
    </div>
  );
}

/** Count pill beside a page title — "Employees (17)". */
export function CountPill({ children }: { children: React.ReactNode }) {
  return (
    <span className="tabular inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-brand-soft px-2 text-xs font-semibold text-[var(--brand-primary)]">
      {children}
    </span>
  );
}
