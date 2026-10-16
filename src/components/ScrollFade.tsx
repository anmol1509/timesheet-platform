"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";

/**
 * A scrolling region that fades out at the bottom edge while there is more below, so the last
 * visible row never looks like it was simply cut off. The fade goes away once you reach the end.
 * Pass the same classes you would give the scrolling div; the region fills its flex parent.
 */
export function ScrollFade({
  className,
  children,
  ...rest
}: React.HTMLAttributes<HTMLDivElement>) {
  const ref = useRef<HTMLDivElement>(null);
  const [more, setMore] = useState(false);

  const update = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    setMore(el.scrollHeight - el.scrollTop - el.clientHeight > 4);
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    update();
    // The region itself changes size with the window; its content changes size as menu groups open and close.
    const observer = new ResizeObserver(update);
    observer.observe(el);
    if (el.firstElementChild) observer.observe(el.firstElementChild);
    return () => observer.disconnect();
  }, [update]);

  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      <div ref={ref} onScroll={update} className={cn("flex-1", className)} {...rest}>
        {children}
      </div>
      <div
        aria-hidden
        className={cn(
          "pointer-events-none absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-[var(--surface)] to-transparent transition-opacity duration-150",
          more ? "opacity-100" : "opacity-0"
        )}
      />
    </div>
  );
}
