"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { DASHBOARD_TABS } from "@/lib/dashboardTabs";
import { cn } from "@/lib/cn";

/**
 * Tab strip across the dashboard routes. Real links rather than client-side
 * panes: each tab is its own server-rendered page, so only the active one
 * queries the database.
 */
export function DashboardTabs() {
  const pathname = usePathname();

  return (
    <div className="-mx-4 overflow-x-auto border-b border-default px-4 sm:-mx-6 sm:px-6">
      <nav className="flex gap-1" aria-label="Dashboard sections">
        {DASHBOARD_TABS.map((tab) => {
          const active = pathname === tab.href;
          return (
            <Link
              key={tab.href}
              href={tab.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "-mb-px shrink-0 border-b-2 px-3 py-2 text-sm font-medium whitespace-nowrap transition",
                active
                  ? "border-[var(--brand-primary)] text-[var(--brand-primary)]"
                  : "border-transparent text-muted hover:text-primary"
              )}
            >
              {tab.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
