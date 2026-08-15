"use client";

import Link from "next/link";
import { useState } from "react";
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { NavLinks } from "./nav-links";
import { Tooltip } from "@/components/ui/Tooltip";
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
  defaultCollapsed,
  header,
  children,
}: {
  isAdmin: boolean;
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
          <Link
            href="/"
            className="flex min-w-0 items-center gap-2.5"
            aria-label="Burj Al Aweer ERP — dashboard"
          >
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-gradient-to-br from-blue-500 to-[var(--brand-navy)] text-[11px] font-bold text-white">
              BA
            </span>
            {!collapsed && (
              <span className="min-w-0">
                <span className="block truncate text-sm font-semibold text-primary">
                  Burj Al Aweer
                </span>
                <span className="block truncate text-[11px] text-subtle">
                  Manpower ERP
                </span>
              </span>
            )}
          </Link>
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
          {!collapsed && (
            <p className="px-2.5 pb-1.5 text-[10px] font-semibold tracking-wider text-subtle uppercase">
              Navigation
            </p>
          )}
          <NavLinks isAdmin={isAdmin} collapsed={collapsed} />
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
        <main className="mx-auto w-full max-w-[1600px] flex-1 px-4 py-6 sm:px-6">
          {children}
        </main>
      </div>
    </div>
  );
}
