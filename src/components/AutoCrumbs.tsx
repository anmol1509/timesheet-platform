"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight, Home } from "lucide-react";
import { getNavPages } from "@/app/(platform)/(app)/nav-links";

type Crumb = { label: string; href?: string };

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

/** Breadcrumbs for a page header that doesn't set its own; kept apart so the header itself stays a server component. */
export function AutoCrumbs({ title }: { title: string }) {
  const crumbs = autoCrumbs(usePathname(), title);
  if (crumbs.length === 0) return null;
  return (
    <nav aria-label="Breadcrumb">
      <ol className="flex flex-wrap items-center gap-1.5 text-xs text-muted">
        <li className="flex items-center">
          <Link href="/" aria-label="Dashboard" className="rounded-xs p-0.5 transition hover:text-primary">
            <Home className="h-3.5 w-3.5" aria-hidden />
          </Link>
        </li>
        {crumbs.map((crumb, i) => (
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
  );
}
