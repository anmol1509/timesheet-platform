"use client";

import { useEffect, useState } from "react";

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
 */
export function FormSaveBar({
  pending,
  saved,
  dirty,
  error,
  label = "Save changes",
}: {
  pending: boolean;
  saved: boolean;
  dirty?: boolean;
  error?: string | null;
  label?: string;
}) {
  return (
    <div className="sticky bottom-0 z-10 -mx-6 mt-2 flex items-center gap-3 border-t border-default bg-surface/95 px-6 py-3 backdrop-blur">
      <button type="submit" disabled={pending} className="btn btn-primary">
        {pending ? "Saving…" : label}
      </button>
      {dirty && !pending && !saved && (
        <span className="text-sm text-[var(--warning)]">Unsaved changes</span>
      )}
      {saved && !pending && <span className="text-sm text-emerald-600">Saved.</span>}
      {error && !pending && <span className="text-sm text-red-600">{error}</span>}
    </div>
  );
}
