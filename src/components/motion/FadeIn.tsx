"use client";

import { m } from "motion/react";
import { DURATION, EASE } from "@/lib/motion";

/**
 * Fade + small rise for content that mounts once (a card, a panel, a section
 * of a page). Not for lists — use Stagger/StaggerItem there so rows don't all
 * animate at once.
 */
export function FadeIn({
  children,
  delay = 0,
  y = 6,
  className,
}: {
  children: React.ReactNode;
  delay?: number;
  y?: number;
  className?: string;
}) {
  return (
    <m.div
      initial={{ opacity: 0, y }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: DURATION, ease: EASE, delay }}
      className={className}
    >
      {children}
    </m.div>
  );
}
