/**
 * Motion tokens, mirrored from the CSS custom properties in globals.css
 * (--duration-fast/--duration/--duration-slow, --ease, --spring) so `motion`
 * animations and CSS transitions stay in lockstep. Durations are in seconds
 * (motion's unit), not ms.
 */
export const EASE = [0.4, 0, 0.2, 1] as const;
export const SPRING = { type: "spring", stiffness: 420, damping: 38, mass: 0.9 } as const;

export const DURATION_FAST = 0.12;
export const DURATION = 0.16;
export const DURATION_SLOW = 0.32;

/** Standard fade/slide-in for content that mounts (cards, panels, rows). */
export const fadeInUp = {
  initial: { opacity: 0, y: 6 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -4 },
  transition: { duration: DURATION, ease: EASE },
};

export const fadeIn = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
  transition: { duration: DURATION, ease: EASE },
};

/** Stagger container — direct children opt in via StaggerItem. */
export const staggerContainer = (staggerChildren = 0.03) => ({
  animate: { transition: { staggerChildren } },
});
