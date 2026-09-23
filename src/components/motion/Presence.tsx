"use client";

import { AnimatePresence } from "motion/react";

/**
 * Thin re-export so call sites import from `@/components/motion` alongside
 * every other motion primitive instead of reaching into `motion/react`
 * directly. Use around a list whose items mount/unmount (row delete, filter
 * change, step change) so exits animate instead of popping.
 */
export const Presence = AnimatePresence;
