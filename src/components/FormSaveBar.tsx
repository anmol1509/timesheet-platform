"use client";

import { useEffect, useState } from "react";
import { m } from "motion/react";
import { Presence } from "@/components/motion";

/**
 * Warns before unsaved edits are thrown away.
 *
 * Every long form in this app holds its edits in memory until Save, and
 * leaving the page used to bin them without a word. Call the returned
 * `onInput` on the <form> and `markSaved()` once the action resolves.
 */
export function useUnsavedGuard() {
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  return {
    dirty,
    onInput: () => setDirty(true),
    markSaved: () => setDirty(false),
  };
}

/**
 * Sticky footer for a long form: the save control stays reachable instead of
 * sitting a thousand-odd pixels below whichever field you just corrected.
 *
 * Only appears once there's something to act on (dirty, mid-save, just
 * saved, or errored) — it used to render permanently, so a record you
 * opened and never touched still showed a live "Save changes" button
 * (Phase 0 audit: easy to edit a read-only visit by accident). `dirty`
 * defaults to `false` rather than `undefined` treated as "always show",
 * so an existing caller that forgets to pass it degrades to hidden, not
 * always-on — the safer failure direction for a button that writes data.
 */
export function FormSaveBar({
  pending,
  saved,
  dirty = false,
  error,
  label = "Save changes",
}: {
  pending: boolean;
  saved: boolean;
  dirty?: boolean;
  error?: string | null;
  label?: string;
}) {
  const visible = dirty || pending || saved || !!error;
  return (
    <Presence>
      {visible && (
        <m.div
          initial={{ opacity: 0, y: 8, height: 0 }}
          animate={{ opacity: 1, y: 0, height: "auto" }}
          exit={{ opacity: 0, y: 8, height: 0 }}
          transition={{ duration: 0.16, ease: [0.4, 0, 0.2, 1] }}
          className="sticky bottom-0 z-10 -mx-6 overflow-hidden"
        >
          <div className="mt-2 flex items-center gap-3 border-t border-default bg-surface/95 px-6 py-3 backdrop-blur">
            <button type="submit" disabled={pending} className="btn btn-primary">
              {pending ? "Saving…" : label}
            </button>
            {dirty && !pending && !saved && (
              <span className="text-sm text-[var(--warning)]">Unsaved changes</span>
            )}
            {saved && !pending && <span className="text-sm text-emerald-600">Saved.</span>}
            {error && !pending && <span className="text-sm text-red-600">{error}</span>}
          </div>
        </m.div>
      )}
    </Presence>
  );
}
