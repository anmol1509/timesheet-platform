"use client";

import { useEffect, useRef } from "react";
import { animate, useMotionValue, useMotionValueEvent, useReducedMotion } from "motion/react";

/**
 * Counts up from 0 (or the previous value, on update) to `value` over
 * ~600ms. Tabular numerals so digits don't shift width mid-count. Renders the
 * final value immediately under prefers-reduced-motion — this is decoration,
 * not a state change that needs explaining, so reduced motion just skips it.
 *
 * `prefix`/`suffix`/`decimals` instead of a `format` callback on purpose:
 * this component is rendered from Server Components (StatTile does it
 * internally for every numeric KPI), and a function prop can't cross that
 * boundary — React throws "Functions cannot be passed directly to Client
 * Components" at request time. That broke the entire dashboard in
 * production/dev until caught here; every prop from here on needs to stay
 * plain serializable data (string/number/boolean), never a callback.
 */
export function AnimatedNumber({
  value,
  prefix = "",
  suffix = "",
  decimals = 0,
  className,
}: {
  value: number;
  prefix?: string;
  suffix?: string;
  decimals?: number;
  className?: string;
}) {
  const prefersReduced = useReducedMotion();
  const spanRef = useRef<HTMLSpanElement>(null);
  const mv = useMotionValue(prefersReduced ? value : 0);

  function fmt(n: number) {
    return `${prefix}${n.toLocaleString(undefined, {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    })}${suffix}`;
  }

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
