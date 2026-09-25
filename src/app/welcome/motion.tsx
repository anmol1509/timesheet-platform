"use client";

// Marketing-page motion primitives. These sit alongside (not instead of) the
// app's existing @/components/motion system — same `m.*` LazyMotion runtime
// from the root MotionProvider, same easing family (the [0.16,1,0.3,1]
// "premium" curve is already the app's convention: it's what
// @/components/motion/AnimatedNumber uses for its count-up). Marketing
// content just runs at a slower, more cinematic pace than dashboard UI, so
// the durations here are its own tokens rather than @/lib/motion's
// 0.12–0.32s UI-interaction timings.
//
// Everything below animates once (`viewport={{ once: true }}`) unless it's a
// tiny hover/press response — see AGENTS.md-style rule in this PR: motion
// should show cause → effect, not decorate every paragraph. Reduced motion
// is handled two ways: declarative `m.*` animations already respect it via
// the root MotionProvider's `MotionConfig reducedMotion="user"`; the two
// manually-driven pipelines here (pointer tilt, scroll parallax) check
// `useReducedMotion()` themselves before applying any transform.

import { useEffect, useRef, useState } from "react";
import {
  m,
  useInView,
  useMotionValue,
  useReducedMotion,
  useScroll,
  useSpring,
  useTransform,
} from "motion/react";
import { AnimatedNumber } from "@/components/motion";

export const EASE_PREMIUM = [0.16, 1, 0.3, 1] as const;
export const DURATION = 0.6;
export const DURATION_SLOW = 0.8;
export const STAGGER = 0.08;

// ---------------------------------------------------------------------------
// Reveal — the single workhorse for "this appeared because you scrolled to
// it". Fade + rise, optional subtle blur for hero-grade moments only.
// ---------------------------------------------------------------------------
type Tag = "div" | "li" | "span" | "p" | "ul" | "h2" | "h3" | "article" | "dl";

export function Reveal({
  children,
  delay = 0,
  y = 24,
  blur = 0,
  duration = DURATION,
  amount = 0.2,
  className,
  as: As = "div",
}: {
  children: React.ReactNode;
  delay?: number;
  y?: number;
  blur?: number;
  duration?: number;
  amount?: number;
  className?: string;
  as?: Tag;
}) {
  const Comp = m[As] as typeof m.div;
  return (
    <Comp
      initial={{ opacity: 0, y, filter: blur ? `blur(${blur}px)` : "blur(0px)" }}
      whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }}
      viewport={{ once: true, amount }}
      transition={{ duration, delay, ease: EASE_PREMIUM }}
      className={className}
    >
      {children}
    </Comp>
  );
}

// ---------------------------------------------------------------------------
// RevealGroup / RevealItem — a list that fades/rises in with a stagger
// (industries strip, challenge cards, portal cards, footer columns).
// ---------------------------------------------------------------------------
export function RevealGroup({
  children,
  className,
  style,
  stagger = STAGGER,
  amount = 0.2,
  as = "div",
}: {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  stagger?: number;
  amount?: number;
  as?: Tag;
}) {
  const Comp = m[as] as typeof m.div;
  return (
    <Comp
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, amount }}
      variants={{ hidden: {}, show: { transition: { staggerChildren: stagger } } }}
      className={className}
      style={style}
    >
      {children}
    </Comp>
  );
}

export function RevealItem({
  children,
  className,
  y = 18,
  as = "div",
}: {
  children: React.ReactNode;
  className?: string;
  y?: number;
  as?: Tag;
}) {
  const Comp = m[as] as typeof m.div;
  return (
    <Comp
      variants={{
        hidden: { opacity: 0, y },
        show: { opacity: 1, y: 0, transition: { duration: DURATION, ease: EASE_PREMIUM } },
      }}
      className={className}
    >
      {children}
    </Comp>
  );
}

// ---------------------------------------------------------------------------
// AnimatedWords — premium word-level reveal for the hero headline. Runs on
// mount (the hero is above the fold, never scrolled to) rather than
// whileInView. Blur+y+opacity per word, small stagger — this is the
// "Blur Text / Split Text" category from the brief, built in-house since
// reactbits.dev isn't reachable from this environment (see final report).
// ---------------------------------------------------------------------------
export function AnimatedWords({
  text,
  startDelay = 0,
  stagger = 0.045,
  className,
}: {
  text: string;
  startDelay?: number;
  stagger?: number;
  className?: string;
}) {
  const words = text.split(" ");
  return (
    <span className={className}>
      {words.map((word, i) => (
        <span key={i} style={{ display: "inline-block", overflow: "hidden", verticalAlign: "top" }}>
          <m.span
            style={{ display: "inline-block" }}
            initial={{ opacity: 0, y: 18, filter: "blur(8px)" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            transition={{ duration: 0.55, ease: EASE_PREMIUM, delay: startDelay + i * stagger }}
          >
            {word}
            {i < words.length - 1 ? " " : ""}
          </m.span>
        </span>
      ))}
    </span>
  );
}

// ---------------------------------------------------------------------------
// CountUpInView — the app's existing AnimatedNumber (already
// server-component-safe, already reduced-motion-safe) gated so it only
// starts counting once scrolled into view, instead of on mount.
// ---------------------------------------------------------------------------
export function CountUpInView({
  value,
  prefix,
  suffix,
  decimals,
  className,
}: {
  value: number;
  prefix?: string;
  suffix?: string;
  decimals?: number;
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.6 });
  return (
    <span ref={ref}>
      <AnimatedNumber value={inView ? value : 0} prefix={prefix} suffix={suffix} decimals={decimals} className={className} />
    </span>
  );
}

// ---------------------------------------------------------------------------
// MagneticButton — desktop-only, pointer-fine-only subtle pull toward the
// cursor for the single most important CTA. Disabled on touch and under
// reduced motion.
// ---------------------------------------------------------------------------
export function MagneticButton({
  children,
  className,
  strength = 10,
}: {
  children: React.ReactNode;
  className?: string;
  strength?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const prefersReduced = useReducedMotion();
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const sx = useSpring(x, { stiffness: 300, damping: 20, mass: 0.5 });
  const sy = useSpring(y, { stiffness: 300, damping: 20, mass: 0.5 });

  function onPointerMove(e: React.PointerEvent) {
    if (prefersReduced || e.pointerType !== "mouse" || !ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    x.set(((e.clientX - rect.left) / rect.width - 0.5) * strength);
    y.set(((e.clientY - rect.top) / rect.height - 0.5) * strength);
  }
  function onPointerLeave() {
    x.set(0);
    y.set(0);
  }

  return (
    <m.div
      ref={ref}
      onPointerMove={onPointerMove}
      onPointerLeave={onPointerLeave}
      style={{ x: sx, y: sy, display: "inline-block" }}
      whileTap={prefersReduced ? undefined : { scale: 0.98 }}
      className={className}
    >
      {children}
    </m.div>
  );
}

// ---------------------------------------------------------------------------
// useScrolled — small hook the nav shell uses to switch into its compact
// floating state past a scroll threshold.
// ---------------------------------------------------------------------------
export function useScrolled(threshold = 8) {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    function onScroll() {
      setScrolled(window.scrollY > threshold);
    }
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [threshold]);
  return scrolled;
}

// ---------------------------------------------------------------------------
// HeroVisual — wraps the hero product mockup with: entrance (fade/scale up,
// after the headline/CTA have landed), a very subtle pointer-tilt on desktop,
// and a scroll parallax (moves slightly slower than the page, gentle scale
// down) as the hero passes. All disabled under reduced motion; pointer-tilt
// also disabled on touch.
// ---------------------------------------------------------------------------
export function HeroVisual({ children, className }: { children: React.ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const prefersReduced = useReducedMotion();
  const [fine] = useState(() => typeof window !== "undefined" && window.matchMedia("(pointer: fine)").matches);
  // Parallax and tilt are desktop flourishes — off on phones/tablets entirely,
  // not just toned down, per the brief's mobile rules.
  const [desktop] = useState(() => typeof window !== "undefined" && window.matchMedia("(min-width: 1024px)").matches);
  const disableMotion = prefersReduced || !desktop;

  const rx = useMotionValue(0);
  const ry = useMotionValue(0);
  const srx = useSpring(rx, { stiffness: 150, damping: 20 });
  const sry = useSpring(ry, { stiffness: 150, damping: 20 });

  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
  const parallaxY = useTransform(scrollYProgress, [0, 1], disableMotion ? [0, 0] : [0, -28]);
  const parallaxScale = useTransform(scrollYProgress, [0, 0.5, 1], disableMotion ? [1, 1, 1] : [0.97, 1, 0.97]);

  function onPointerMove(e: React.PointerEvent) {
    if (disableMotion || !fine || !ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const px = (e.clientX - rect.left) / rect.width - 0.5;
    const py = (e.clientY - rect.top) / rect.height - 0.5;
    ry.set(px * 3);
    rx.set(py * -3);
  }
  function onPointerLeave() {
    rx.set(0);
    ry.set(0);
  }

  return (
    <m.div
      ref={ref}
      onPointerMove={onPointerMove}
      onPointerLeave={onPointerLeave}
      initial={{ opacity: 0, y: 32, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.7, ease: EASE_PREMIUM, delay: 0.5 }}
      style={{
        y: parallaxY,
        scale: parallaxScale,
        rotateX: srx,
        rotateY: sry,
        transformPerspective: 1400,
      }}
      className={className}
    >
      {children}
    </m.div>
  );
}
