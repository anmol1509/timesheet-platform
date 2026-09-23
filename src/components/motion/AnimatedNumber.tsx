"use client";

import { useEffect, useRef } from "react";
import { animate, useMotionValue, useMotionValueEvent, useReducedMotion } from "motion/react";

/**
 * Counts up from 0 (or the previous value, on update) to `value` over
 * ~600ms. Tabular numerals so digits don't shift width mid-count. Renders the
 * final value immediately under prefers-reduced-motion — this is decoration,
 * not a state change that needs explaining, so reduced motion just skips it.
 */
export function AnimatedNumber({
  value,
  format,
  className,
}: {
  value: number;
  /** e.g. (n) => n.toLocaleString() or (n) => `${n}%` */
  format?: (n: number) => string;
  className?: string;
}) {
  const prefersReduced = useReducedMotion();
  const spanRef = useRef<HTMLSpanElement>(null);
  const mv = useMotionValue(prefersReduced ? value : 0);
  const fmt = format ?? ((n: number) => Math.round(n).toLocaleString());

  useMotionValueEvent(mv, "change", (latest) => {
    if (spanRef.current) spanRef.current.textContent = fmt(latest);
  });

  useEffect(() => {
    if (prefersReduced) {
      mv.set(value);
      return;
    }
    const controls = animate(mv, value, { duration: 0.6, ease: [0.16, 1, 0.3, 1] });
    return () => controls.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, prefersReduced]);

  return (
    <span ref={spanRef} className={className}>
      {fmt(prefersReduced ? value : 0)}
    </span>
  );
}
