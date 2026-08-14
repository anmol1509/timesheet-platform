"use client";

import { cn } from "@/lib/cn";

/**
 * Minimal CSS-only tooltip. Deliberately not a Radix primitive — @radix-ui
 * /react-tooltip isn't in the dependency list and the only requirement is a
 * label for icon-only controls (collapsed sidebar, table row actions).
 *
 * The label is also wired up via aria-label on the trigger by the caller, so
 * screen readers don't depend on this visual layer.
 */
export function Tooltip({
  label,
  side = "right",
  children,
  className,
}: {
  label: string;
  side?: "right" | "top" | "bottom";
  children: React.ReactNode;
  className?: string;
}) {
  const position =
    side === "right"
      ? "top-1/2 left-full ml-2 -translate-y-1/2"
      : side === "top"
        ? "bottom-full left-1/2 mb-2 -translate-x-1/2"
        : "top-full left-1/2 mt-2 -translate-x-1/2";

  return (
    <span className={cn("group/tt relative inline-flex", className)}>
      {children}
      <span
        role="tooltip"
        className={cn(
          "pointer-events-none absolute z-50 whitespace-nowrap rounded-md bg-[#101828] px-2 py-1 text-xs font-medium text-white opacity-0 shadow-md transition-opacity duration-100",
          "group-hover/tt:opacity-100 group-focus-within/tt:opacity-100",
          position
        )}
      >
        {label}
      </span>
    </span>
  );
}
