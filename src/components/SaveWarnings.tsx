"use client";

import { AlertTriangle } from "lucide-react";

/**
 * What a save found that is probably a mistake but isn't certain: the person either goes back and fixes it, or saves
 * anyway. Used wherever a form's server action answers with `warnings`.
 */
export function SaveWarnings({ warnings, onSaveAnyway, onDismiss, busy }: { warnings: string[]; onSaveAnyway: () => void; onDismiss: () => void; busy?: boolean }) {
  return (
    <div role="alert" className="rounded-md border border-[var(--warning-border)] bg-[var(--warning-soft)] p-4 text-sm">
      <p className="flex items-center gap-2 font-semibold text-primary"><AlertTriangle className="h-4 w-4 text-[var(--warning)]" aria-hidden />Please check before saving</p>
      <ul className="mt-2 list-disc space-y-1 pl-5 text-secondary">
        {warnings.map((w, i) => <li key={i}>{w}</li>)}
      </ul>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button type="button" className="btn btn-secondary" onClick={onDismiss} disabled={busy}>Go back and fix</button>
        <button type="button" className="btn btn-primary" onClick={onSaveAnyway} disabled={busy}>{busy ? "Saving…" : "Save anyway"}</button>
      </div>
    </div>
  );
}
