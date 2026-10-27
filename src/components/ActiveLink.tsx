"use client";

import Link from "next/link";
import { cn } from "@/lib/cn";
import { useActiveHref } from "./useActiveHref";

/**
 * A link to a filtered list that shows when it is the one on show (`activeClassName`, aria-current) and clears itself on a
 * second click. Used by the KPI cards and the chart items, so every module marks its active filter the same way.
 */
export function ActiveLink({ href, className, activeClassName, style, children, title }: { href: string; className?: string; activeClassName?: string; style?: React.CSSProperties; children: React.ReactNode; title?: string }) {
  const { active, to } = useActiveHref(href);
  return (
    <Link href={to ?? href} scroll={false} aria-current={active ? "true" : undefined} title={title ?? (active ? "Showing this. Click to clear." : undefined)} className={cn(className, active && (activeClassName ?? "border-[var(--brand-primary)] ring-2 ring-[var(--brand-primary)]/30"))} style={style}>
      {children}
    </Link>
  );
}
