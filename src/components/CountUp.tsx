"use client";

import { useEffect, useRef } from "react";
import { animate } from "motion/react";

/** Animates a number counting up to `value` on mount/change — used for chart
 * totals so a fresh render feels alive instead of just appearing. */
export function CountUp({ value, className, suffix = "" }: { value: number; className?: string; suffix?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const controls = animate(0, value, {
      duration: 0.7,
      ease: [0.16, 1, 0.3, 1],
      onUpdate(v) {
        node.textContent = `${Math.round(v).toLocaleString()}${suffix}`;
      },
    });
    return () => controls.stop();
  }, [value, suffix]);
  return (
    <span ref={ref} className={className}>
      {value.toLocaleString()}
      {suffix}
    </span>
  );
}
