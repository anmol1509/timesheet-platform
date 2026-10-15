"use client";

import { useCallback, useSyncExternalStore } from "react";

/**
 * A per-browser preference (collapsed panels, remembered views). Read through
 * useSyncExternalStore so the server render and the first client render agree
 * (both see "nothing saved") and the saved value then arrives without an
 * effect pushing state around. Never use it for anything that must follow the
 * person to another device.
 */
const EVENT = "viewer-pref";

function subscribe(cb: () => void) {
  window.addEventListener("storage", cb);
  window.addEventListener(EVENT, cb);
  return () => {
    window.removeEventListener("storage", cb);
    window.removeEventListener(EVENT, cb);
  };
}

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function useViewerPref(key: string): [string | null, (value: string) => void] {
  const value = useSyncExternalStore(
    subscribe,
    () => read(key),
    () => null
  );
  const set = useCallback(
    (next: string) => {
      try {
        localStorage.setItem(key, next);
      } catch {
        /* private mode: the choice just isn't remembered */
      }
      window.dispatchEvent(new Event(EVENT));
    },
    [key]
  );
  return [value, set];
}
