"use client";

import { m } from "motion/react";
import { DURATION, EASE } from "@/lib/motion";

/**
 * Wrap a list of `StaggerItem`s in this to fade/rise them in with a small
 * delay between each. Hard-capped use case: dashboard panels, KPI tiles,
 * short lists (≤ ~30 items — see the motion guardrail in the redesign plan).
 * Do not wrap full data tables with hundreds of rows in this.
 */
export function Stagger({
  children,
  className,
  staggerChildren = 0.03,
}: {
  children: React.ReactNode;
  className?: string;
  staggerChildren?: number;
}) {
  return (
    <m.div
      initial="hidden"
      animate="show"
      variants={{
        hidden: {},
        show: { transition: { staggerChildren } },
      }}
      className={className}
    >
      {children}
    </m.div>
  );
}

export function StaggerItem({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <m.div
      variants={{
        hidden: { opacity: 0, y: 8 },
        show: { opacity: 1, y: 0, transition: { duration: DURATION, ease: EASE } },
      }}
      className={className}
    >
      {children}
    </m.div>
  );
}
