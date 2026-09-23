"use client";

import { LazyMotion, domAnimation, MotionConfig } from "motion/react";

/**
 * App-wide motion setup. `domAnimation` is the smaller feature bundle
 * (no layout/drag — those routes opt in with `m` + explicit layout props
 * where needed); `MotionConfig reducedMotion="user"` makes every `m.*`
 * animation respect prefers-reduced-motion automatically, so individual
 * components don't each need a media-query check.
 *
 * Mounted once in the root layout, outside the shell, so login and the
 * error/global-error boundaries can use motion components too.
 */
export function MotionProvider({ children }: { children: React.ReactNode }) {
  return (
    <LazyMotion features={domAnimation} strict>
      <MotionConfig reducedMotion="user">{children}</MotionConfig>
    </LazyMotion>
  );
}
