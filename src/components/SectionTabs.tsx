"use client";

import Link from "next/link";
import { m } from "motion/react";
import { usePathname } from "next/navigation";
import { sectionFor } from "@/lib/sectionTabs";
import { cn } from "@/lib/cn";
import { SPRING } from "@/lib/motion";

/**
 * Switcher for pages that share one sidebar row (see lib/sectionTabs). Mounted
 * once in the app shell, so individual pages don't opt in and nothing renders
 * on routes outside a section.
 */
export function SectionTabs() {
  const pathname = usePathname();
  const section = sectionFor(pathname);
  if (!section) return null;

  return (
    <nav aria-label="Section" className="-mx-4 mb-6 overflow-x-auto border-b border-default px-4 sm:-mx-6 sm:px-6">
      <div className="flex gap-1">
        {section.tabs.map((tab) => {
          const active = tab.href === section.activeHref;
          return (
            <Link
              key={tab.href}
              href={tab.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "relative -mb-px inline-flex min-h-10 items-center border-b-2 border-transparent px-3 text-[13px] font-medium whitespace-nowrap transition-colors duration-200",
                active
                  ? "text-[var(--brand-primary)]"
                  : "text-muted hover:border-[var(--border-strong)] hover:text-primary"
              )}
            >
              {tab.label}
              {active && (
                <m.span
                  layoutId="section-tabs-underline"
                  transition={SPRING}
                  className="absolute inset-x-0 -bottom-0.5 h-0.5 rounded-full bg-[var(--brand-primary)]"
                  aria-hidden
                />
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
