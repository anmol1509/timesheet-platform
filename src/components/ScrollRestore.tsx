"use client";

import { useLayoutEffect, useRef } from "react";
import { usePathname } from "next/navigation";

/**
 * A scrollable box that remembers how far it was scrolled. Going into a row and
 * pressing Back re-renders the list from scratch, which put a wide table back at
 * its left edge; this puts it back where you left it.
 */
export function ScrollRestore({ id, className, children }: { id: string; className?: string; children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const path = usePathname();
  const key = `scroll:${path}:${id}`;

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    try {
      const saved = JSON.parse(sessionStorage.getItem(key) ?? "null") as { x: number; y: number } | null;
      if (saved) el.scrollTo(saved.x, saved.y);
    } catch {
      /* storage unavailable — start at the left as before */
    }
    let raf = 0;
    const save = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        try {
          sessionStorage.setItem(key, JSON.stringify({ x: el.scrollLeft, y: el.scrollTop }));
        } catch {
          /* ignore */
        }
      });
    };
    el.addEventListener("scroll", save, { passive: true });
    return () => {
      el.removeEventListener("scroll", save);
      cancelAnimationFrame(raf);
    };
  }, [key]);

  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}
