"use client";

import { LazyMotion, domMax, MotionConfig } from "motion/react";

/**
 * App-wide motion setup. `domMax` (not the smaller `domAnimation` bundle —
 * see the correction below) because the sidebar's active-item rail and
 * AnimatedTabs' sliding underline both use `layoutId` shared-layout
 * transitions, which need the `layout` feature; `domAnimation` doesn't
 * include it and silently skips the animation (no error, just no motion)
 * rather than failing loudly, so this was wrong for a few phases before
 * being caught. `domMax` also pulls in `drag`/`pan`, unused here, but
 * there's no smaller pre-built bundle with layout-but-not-drag — still
 * lazy-loaded via LazyMotion, so it costs nothing on first paint.
 *
 * `MotionConfig reducedMotion="user"` makes every `m.*` animation respect
 * prefers-reduced-motion automatically, so individual components don't each
 * need a media-query check.
 *
 * Mounted once in the root layout, outside the shell, so login and the
 * error/global-error boundaries can use motion components too.
 */
export function MotionProvider({ children }: { children: React.ReactNode }) {
  return (
    <LazyMotion features={domMax} strict>
      <MotionConfig reducedMotion="user">{children}</MotionConfig>
    </LazyMotion>
  );
}
