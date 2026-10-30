"use client";

import { useEffect } from "react";

/**
 * Lets the mouse wheel (and touch) scroll a dropdown that opens over a pop-up window or side panel. An open dialog locks scrolling
 * for everything outside it, and a dropdown is drawn outside it, so its list only moved when its scrollbar was dragged. The
 * dropdown's own events are kept from reaching that lock, so the browser scrolls the list as usual.
 */
export function PopoverScrollFix() {
  useEffect(() => {
    const inside = (e: Event) => e.target instanceof Element && !!e.target.closest("[data-radix-popper-content-wrapper]");
    const keep = (e: Event) => { if (inside(e)) e.stopPropagation(); };
    window.addEventListener("wheel", keep, { capture: true, passive: true });
    window.addEventListener("touchmove", keep, { capture: true, passive: true });
    return () => {
      window.removeEventListener("wheel", keep, { capture: true });
      window.removeEventListener("touchmove", keep, { capture: true });
    };
  }, []);
  return null;
}
