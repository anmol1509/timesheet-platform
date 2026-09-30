"use client";

import { useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/cn";

const COOKIE = "gs_collapsed";

/** The Get started card's header with a show/hide arrow, and the steps it folds away. The choice is remembered in a cookie so the server renders it already folded. */
export function CollapsibleSteps({ summary, defaultCollapsed, children }: { summary: ReactNode; defaultCollapsed: boolean; children: ReactNode }) {
  const [collapsed, setCollapsed] = useState(defaultCollapsed);
  function toggle() {
    const next = !collapsed;
    setCollapsed(next);
    try {
      document.cookie = `${COOKIE}=${next ? "1" : "0"}; path=/; max-age=31536000; samesite=lax`;
    } catch {
      /* the choice just isn't remembered */
    }
  }
  return (
    <>
      <div className={cn("flex flex-wrap items-center justify-between gap-3 bg-surface-subtle px-5 py-4", !collapsed && "border-b border-default")}>
        {summary}
        <button
          type="button"
          onClick={toggle}
          aria-expanded={!collapsed}
          aria-label={collapsed ? "Show setup steps" : "Hide setup steps"}
          title={collapsed ? "Show steps" : "Hide steps"}
          className="btn btn-sm btn-secondary shrink-0 px-2"
        >
          <ChevronDown className={cn("h-4 w-4 transition-transform", !collapsed && "rotate-180")} aria-hidden />
        </button>
      </div>
      <div hidden={collapsed}>{children}</div>
    </>
  );
}
