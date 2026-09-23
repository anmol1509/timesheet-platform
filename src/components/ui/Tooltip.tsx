"use client";

import * as RadixTooltip from "@radix-ui/react-tooltip";

/**
 * Radix Tooltip — replaces the earlier CSS-only version. That one broke
 * inside `overflow-x-auto` tables (a clipped ancestor clips a
 * non-portalled tooltip too) and couldn't flip side near a viewport edge.
 * Same call signature (`label`, `side`, `children`), so no call sites needed
 * to change. `delayDuration={200}` matches the old version's near-instant
 * feel; `asChild` puts the trigger role on the actual child element instead
 * of wrapping it in an extra `<span>`.
 */
export function Tooltip({
  label,
  side = "right",
  children,
  className,
}: {
  label: string;
  side?: "right" | "top" | "bottom" | "left";
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <RadixTooltip.Provider delayDuration={200} skipDelayDuration={100}>
      <RadixTooltip.Root>
        <RadixTooltip.Trigger asChild className={className}>
          {children}
        </RadixTooltip.Trigger>
        <RadixTooltip.Portal>
          <RadixTooltip.Content
            side={side}
            sideOffset={8}
            collisionPadding={8}
            className="rx-popover z-50 rounded-md bg-[var(--tooltip-bg)] px-2 py-1 text-xs font-medium text-[var(--tooltip-text)] shadow-md"
          >
            {label}
            <RadixTooltip.Arrow className="fill-[var(--tooltip-bg)]" />
          </RadixTooltip.Content>
        </RadixTooltip.Portal>
      </RadixTooltip.Root>
    </RadixTooltip.Provider>
  );
}
