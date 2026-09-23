"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { m, useReducedMotion } from "motion/react";

/**
 * Thin bar under the header that fills while a navigation is in flight —
 * direct answer to the audit's #1 finding (clicks feel dead: 0.75–2.7s TTFB
 * and only 13/76 routes have a loading.tsx). Starts on `pointerdown` of any
 * internal same-origin link (before the click even resolves, so it reads as
 * instant), creeps toward 80% while waiting, and snaps to 100% then fades
 * when the pathname/search params actually change (i.e. the navigation
 * committed). A safety timeout clears it if a click didn't turn into a nav
 * (e.g. it opened a dialog instead).
 */
export function ProgressBar() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [progress, setProgress] = useState(0);
  const [visible, setVisible] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const safetyRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reduced = useReducedMotion();

  // Start on pointerdown of any internal link — before the click even
  // resolves, so the bar reads as instant.
  useEffect(() => {
    function clearTimers() {
      if (timerRef.current) clearInterval(timerRef.current);
      if (safetyRef.current) clearTimeout(safetyRef.current);
    }

    function start() {
      clearTimers();
      setVisible(true);
      setProgress(12);
      timerRef.current = setInterval(() => {
        setProgress((p) => (p < 80 ? p + (80 - p) * 0.1 : p));
      }, 200);
      // If no navigation follows within 4s, this pointerdown wasn't a route
      // change (opened a dialog, was a no-op link, etc) — clear silently.
      safetyRef.current = setTimeout(() => {
        clearTimers();
        setVisible(false);
        setProgress(0);
      }, 4000);
    }

    function onPointerDown(e: PointerEvent) {
      const link = (e.target as HTMLElement)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!link) return;
      const href = link.getAttribute("href") || "";
      if (
        !href ||
        href.startsWith("#") ||
        href.startsWith("http") ||
        href.startsWith("mailto:") ||
        link.target === "_blank" ||
        e.button !== 0 ||
        e.metaKey ||
        e.ctrlKey
      ) {
        return;
      }
      start();
    }

    document.addEventListener("pointerdown", onPointerDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      clearTimers();
    };
  }, []);

  // The route committing (pathname/search params changed) is the signal to
  // finish the bar. Deferred one tick so the state updates happen inside a
  // callback rather than synchronously in the effect body.
  useEffect(() => {
    const finish = setTimeout(() => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (safetyRef.current) clearTimeout(safetyRef.current);
      setVisible((wasVisible) => {
        if (!wasVisible) return wasVisible;
        setProgress(100);
        return wasVisible;
      });
    }, 0);
    return () => clearTimeout(finish);
  }, [pathname, searchParams]);

  // Once progress hits 100, hold briefly then hide and reset.
  useEffect(() => {
    if (progress !== 100) return;
    const hide = setTimeout(() => {
      setVisible(false);
      setProgress(0);
    }, 200);
    return () => clearTimeout(hide);
  }, [progress]);

  if (!visible) return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-[60] h-0.5 overflow-hidden">
      <m.div
        className="h-full bg-[var(--brand-primary)]"
        animate={{ width: `${progress}%`, opacity: progress >= 100 ? 0 : 1 }}
        transition={reduced ? { duration: 0 } : { duration: 0.2, ease: "easeOut" }}
      />
    </div>
  );
}
