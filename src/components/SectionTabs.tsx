"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { sectionFor } from "@/lib/sectionTabs";
import { cn } from "@/lib/cn";

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
    <nav aria-label="Section" className="mb-5 overflow-x-auto">
      <div className="inline-flex gap-0.5 rounded-control bg-[var(--surface-sunken)] p-0.5">
        {section.tabs.map((tab) => {
          const active = tab.href === section.activeHref;
          return (
            <Link
              key={tab.href}
              href={tab.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "rounded-[6px] px-3 py-1 text-[13px] font-medium whitespace-nowrap transition",
                active
                  ? "bg-surface text-primary shadow-xs"
                  : "text-muted hover:text-primary"
              )}
            >
              {tab.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
