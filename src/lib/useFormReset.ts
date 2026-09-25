import { useEffect, useRef, type RefObject } from "react";

/** Runs `onReset` when the form containing `ref` is reset, so fields that keep their own state clear along with native inputs. */
export function useFormReset(ref: RefObject<HTMLElement | null>, onReset: () => void) {
  const latest = useRef(onReset);
  useEffect(() => {
    latest.current = onReset;
  });
  useEffect(() => {
    const form = ref.current?.closest("form");
    if (!form) return;
    // Defer past the native reset so it doesn't overwrite what we set.
    const handler = () => setTimeout(() => latest.current(), 0);
    form.addEventListener("reset", handler);
    return () => form.removeEventListener("reset", handler);
  }, [ref]);
}
