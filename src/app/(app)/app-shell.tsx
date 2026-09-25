"use client";

import { useState } from "react";
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { NavLinks } from "./nav-links";
import { BrandMark, type Brand } from "@/components/BrandMark";
import { Tooltip } from "@/components/ui/Tooltip";
import { SectionTabs } from "@/components/SectionTabs";
import { SIDEBAR_COOKIE } from "./sidebar-preference";
import { cn } from "@/lib/cn";

/**
 * Chrome for the authenticated app: fixed sidebar + sticky header + content
 * column. The only client component in the shell — `header` and `children` are
 * server-rendered and passed straight through, so an interactive sidebar
 * doesn't pull the page tree onto the client.
 *
 * The collapsed preference arrives from the server (read from a cookie in the
 * layout), so the first paint is already correct: no mount effect, no
 * hydration mismatch, and no sidebar snapping shut after load. Toggling
 * updates state immediately and writes the cookie directly, so there's no
 * server round-trip.
 */
export function AppShell({
  isAdmin,
  isSuperAdmin,
  allowedModules,
  pendingApprovals,
  brand,
  defaultCollapsed,
  header,
  children,
}: {
  isAdmin: boolean;
  isSuperAdmin: boolean;
  allowedModules: string[] | null;
  pendingApprovals?: number;
  brand: Brand;
  defaultCollapsed: boolean;
  header: React.ReactNode;
  children: React.ReactNode;
}) {
  const [collapsed, setCollapsed] = useState(defaultCollapsed);

  function toggle() {
    const next = !collapsed;
    setCollapsed(next);
    // Year-long, lax, site-wide — a non-sensitive layout preference.
    document.cookie = `${SIDEBAR_COOKIE}=${next ? "1" : "0"};path=/;max-age=31536000;samesite=lax`;
  }

  return (
    <div className="min-h-screen bg-canvas lg:flex">
      <aside
        className={cn(
          "hidden shrink-0 flex-col border-r border-default bg-surface transition-[width] duration-200 lg:fixed lg:inset-y-0 lg:flex",
          collapsed ? "w-14" : "w-60"
        )}
      >
        <div
          className={cn(
            "flex h-14 shrink-0 items-center border-b border-default",
            collapsed ? "justify-center px-2" : "justify-between pr-2 pl-3"
          )}
        >
          <BrandMark brand={brand} collapsed={collapsed} />
          {!collapsed && (
            <button
              type="button"
              onClick={toggle}
              aria-label="Collapse sidebar"
              className="shrink-0 rounded-md p-1.5 text-subtle transition hover:bg-surface-hover hover:text-secondary"
            >
              <PanelLeftClose className="h-4 w-4" />
            </button>
          )}
        </div>

        <div
          className={cn(
            "flex-1 overflow-x-hidden overflow-y-auto py-3",
            collapsed ? "px-2" : "px-3"
          )}
        >
          <NavLinks isAdmin={isAdmin} isSuperAdmin={isSuperAdmin} allowedModules={allowedModules} collapsed={collapsed} pendingApprovals={pendingApprovals} />
        </div>

        {collapsed && (
          <div className="flex shrink-0 justify-center border-t border-default p-2">
            <Tooltip label="Expand sidebar">
              <button
                type="button"
                onClick={toggle}
                aria-label="Expand sidebar"
                className="rounded-md p-1.5 text-subtle transition hover:bg-surface-hover hover:text-secondary"
              >
                <PanelLeftOpen className="h-4 w-4" />
              </button>
            </Tooltip>
          </div>
        )}
      </aside>

      <div
        data-shell-main
        className={cn(
          // `min-w-0` matters: without it this flex child refuses to shrink
          // below its content's min-content width, so a wide table pushed the
          // whole page sideways instead of scrolling inside its own card.
          "flex min-h-screen min-w-0 flex-1 flex-col transition-[padding] duration-200",
          collapsed ? "lg:pl-14" : "lg:pl-60"
        )}
      >
        {header}
        <main className="mx-auto w-full max-w-[1600px] flex-1 px-4 pt-6 pb-24 sm:px-6">
          <SectionTabs />
          {children}
        </main>
      </div>
    </div>
  );
}
