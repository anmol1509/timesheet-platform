"use client";

import * as RadixTabs from "@radix-ui/react-tabs";
import { m } from "motion/react";
import { cn } from "@/lib/cn";
import { SPRING } from "@/lib/motion";

export type TabItem = { value: string; label: string; badge?: React.ReactNode };

/**
 * Tab row with one underline that slides between the active tab (shared
 * `layoutId`, so it morphs instead of jumping). Built on Radix Tabs for
 * roving-tabindex keyboard support and correct ARIA — the app's existing
 * hand-rolled tab rows (project detail, supplier detail, demand stage pages)
 * are candidates to move onto this in Phase 5/6.
 */
export function AnimatedTabs({
  tabs,
  value,
  onValueChange,
  layoutId = "animated-tabs-underline",
  className,
}: {
  tabs: TabItem[];
  value: string;
  onValueChange: (value: string) => void;
  /** Unique per tab group when more than one AnimatedTabs is on screen at once. */
  layoutId?: string;
  className?: string;
}) {
  return (
    <RadixTabs.Root value={value} onValueChange={onValueChange}>
      <RadixTabs.List
        className={cn("flex items-center gap-1 border-b border-default", className)}
      >
        {tabs.map((tab) => {
          const active = tab.value === value;
          return (
            <RadixTabs.Trigger
              key={tab.value}
              value={tab.value}
              className={cn(
                "relative flex items-center gap-1.5 px-3 py-2 text-sm font-medium whitespace-nowrap transition-colors focus-visible:outline-none",
                active ? "text-primary" : "text-muted hover:text-secondary"
              )}
            >
              {tab.label}
              {tab.badge}
              {active && (
                <m.span
                  layoutId={layoutId}
                  transition={SPRING}
                  className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-[var(--brand-primary)]"
                />
              )}
            </RadixTabs.Trigger>
          );
        })}
      </RadixTabs.List>
    </RadixTabs.Root>
  );
}
