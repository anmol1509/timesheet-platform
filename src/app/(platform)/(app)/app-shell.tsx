"use client";

import { useEffect, useState } from "react";
import { PanelLeftClose, PanelLeftOpen, Search, X } from "lucide-react";
import { NavLinks } from "./nav-links";
import { ModuleList, ModuleTabs, TopNav, TwoLevelNav } from "./nav-layouts";
import type { LayoutKey } from "@/lib/preferences";
import { BranchCard, BrandMark, type Brand } from "@/components/BrandMark";
import { SidebarHelp } from "@/components/SidebarHelp";
import { ScrollFade } from "@/components/ScrollFade";
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
  badges,
  brand,
  defaultCollapsed,
  layout: savedLayout = "classic",
  header,
  children,
}: {
  isAdmin: boolean;
  isSuperAdmin: boolean;
  allowedModules: string[] | null;
  pendingApprovals?: number;
  badges?: Record<string, number>;
  brand: Brand;
  defaultCollapsed: boolean;
  layout?: LayoutKey;
  header: React.ReactNode;
  children: React.ReactNode;
}) {
  const [collapsedSaved, setCollapsed] = useState(defaultCollapsed);
  const [layout, setLayout] = useState<LayoutKey>(savedLayout);
  const [query, setQuery] = useState("");
  // The Appearance page previews a layout before it is saved.
  useEffect(() => {
    const on = (e: Event) => setLayout((e as CustomEvent<LayoutKey>).detail);
    window.addEventListener("layout-preview", on);
    return () => window.removeEventListener("layout-preview", on);
  }, []);
  // Only the classic layout has the open / icons-only toggle; the icon rail is always icons, the others always open.
  const collapsed = layout === "rail" ? true : layout === "classic" ? collapsedSaved : false;
  const sidebarLayout = layout === "classic" || layout === "rail" || layout === "search";
  const navProps = { isAdmin, allowedModules, pendingApprovals, badges };
  const branch = <BranchCard brand={brand} isAdmin={isAdmin} compact />;

  function toggle() {
    const next = !collapsedSaved;
    setCollapsed(next);
    // Year-long, lax, site-wide — a non-sensitive layout preference.
    document.cookie = `${SIDEBAR_COOKIE}=${next ? "1" : "0"};path=/;max-age=31536000;samesite=lax`;
  }

  return (
    <div className="app-aurora relative min-h-screen bg-canvas lg:flex">
      {layout === "topbar" ? null : layout === "twolevel" ? <TwoLevelNav {...navProps} brandSlot={branch} /> : layout === "tabs" ? <ModuleList {...navProps} brandSlot={branch} /> : null}
      {sidebarLayout && <aside
        className={cn(
          "glass hidden shrink-0 flex-col overflow-hidden rounded-[22px] transition-[width] duration-200 lg:fixed lg:top-3 lg:bottom-3 lg:left-3 lg:flex",
          collapsed ? (layout === "rail" ? "w-20" : "w-16") : "w-64"
        )}
      >
        <div
          className={cn(
            "flex h-16 shrink-0 items-center",
            collapsed ? "justify-center px-2" : "justify-between pr-2.5 pl-4"
          )}
        >
          <BrandMark collapsed={collapsed} />
          {!collapsed && layout === "classic" && (
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

        {!collapsed && (
          <div className="shrink-0 px-3 pb-1">
            <BranchCard brand={brand} isAdmin={isAdmin} compact />
          </div>
        )}

        {layout === "search" && (
          <div className="shrink-0 px-3 pb-1">
            <label className="relative block">
              <span className="sr-only">Search pages</span>
              <Search className="pointer-events-none absolute top-1/2 left-2.5 h-4 w-4 -translate-y-1/2 text-subtle" aria-hidden />
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Find a page…" className="input h-9 w-full pr-8 pl-8 text-[13px]" />
              {query && <button type="button" onClick={() => setQuery("")} aria-label="Clear search" className="absolute top-1/2 right-1.5 -translate-y-1/2 rounded p-1 text-subtle hover:text-primary"><X className="h-3.5 w-3.5" /></button>}
            </label>
          </div>
        )}

        {/* Module names only, so Clarity recordings (masked everywhere else, see app-analytics.tsx) show where people go. */}
        <ScrollFade
          data-clarity-unmask="true"
          className={cn(
            "overflow-x-hidden overflow-y-auto overscroll-contain py-2",
            collapsed ? "px-2" : "px-3"
          )}
        >
          <NavLinks isAdmin={isAdmin} isSuperAdmin={isSuperAdmin} allowedModules={allowedModules} collapsed={collapsed} pendingApprovals={pendingApprovals} badges={badges} query={layout === "search" ? query : ""} labels={layout === "rail"} />
        </ScrollFade>

        {!collapsed && (
          <div className="shrink-0 border-t border-default p-3">
            <SidebarHelp />
          </div>
        )}

        {collapsed && layout === "classic" && (
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
      </aside>}

      <div
        data-shell-main
        className={cn(
          // `min-w-0` matters: without it this flex child refuses to shrink
          // below its content's min-content width, so a wide table pushed the
          // whole page sideways instead of scrolling inside its own card.
          "flex min-h-screen min-w-0 flex-1 flex-col transition-[padding] duration-200",
          layout === "topbar" ? "lg:[&>header]:ml-3" : layout === "twolevel" ? "lg:pl-[21.25rem]" : layout === "tabs" ? "lg:pl-[15.5rem]" : layout === "rail" ? "lg:pl-[6.5rem]" : collapsed ? "lg:pl-[5.5rem]" : "lg:pl-[17.5rem]"
        )}
      >
        {header}
        {layout === "topbar" && <TopNav {...navProps} brandSlot={branch} />}
        <main className="mx-auto w-full max-w-[1600px] flex-1 px-4 pt-6 pb-24 sm:px-6 lg:px-8 lg:pt-7">
          {layout === "tabs" && <ModuleTabs {...navProps} />}
          <SectionTabs />
          {children}
        </main>
      </div>
    </div>
  );
}
