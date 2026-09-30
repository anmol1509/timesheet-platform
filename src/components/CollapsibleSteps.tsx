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
      <div className={cn("flex flex-wrap items-center justify-between gap-3 border-b bg-surface-subtle px-5 py-4 transition-colors duration-300", collapsed ? "border-transparent" : "border-default")}>
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
      {/* 0fr -> 1fr animates the height without measuring it. */}
      <div
        className={cn(
          "grid transition-[grid-template-rows,opacity] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none",
          collapsed ? "grid-rows-[0fr] opacity-0" : "grid-rows-[1fr] opacity-100",
        )}
        aria-hidden={collapsed}
        inert={collapsed}
      >
        <div className="min-h-0 overflow-hidden">{children}</div>
      </div>
    </>
  );
}
