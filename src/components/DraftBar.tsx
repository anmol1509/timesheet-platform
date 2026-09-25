"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CheckCircle2, FileClock, RotateCcw, Save, Trash2 } from "lucide-react";
import { discardDraftAction, loadDraftAction, saveDraftAction } from "@/app/(app)/drafts/actions";
import type { DraftType } from "@/lib/draftTypes";

const AUTOSAVE_MS = 8000;

function ago(iso: string) {
  const mins = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const h = Math.round(mins / 60);
  if (h < 24) return `${h} hour${h === 1 ? "" : "s"} ago`;
  const d = Math.round(h / 24);
  return `${d} day${d === 1 ? "" : "s"} ago`;
}

/**
 * "Save as draft" for a form whose values live in React state.
 *
 * The form passes a plain, serialisable snapshot of itself (`state`) and a way to put one back
 * (`onRestore`). This saves it on demand and on a short timer after each change, offers to restore
 * an earlier draft when the form opens, and never validates anything: half-filled is the point.
 * The create action clears the draft once the record is really saved.
 *
 * `hasContent` keeps a blank form from being saved as a draft. Files can't be stored, so
 * a form that takes uploads should say so beside the bar.
 */
export function DraftBar<S>({
  type,
  draftKey = "new",
  state,
  title,
  hasContent,
  onRestore,
  note,
}: {
  type: DraftType;
  draftKey?: string;
  state: S;
  title?: string;
  hasContent: boolean;
  onRestore: (s: S) => void;
  note?: string;
}) {
  const [existing, setExisting] = useState<{ payload: S; updatedAt: string } | null>(null);
  const [decided, setDecided] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lastSaved = useRef<string>("");
  const snapshot = JSON.stringify(state);

  useEffect(() => {
    let live = true;
    loadDraftAction({ type, key: draftKey }).then((d) => {
      if (!live) return;
      if (d) setExisting({ payload: d.payload as S, updatedAt: d.updatedAt });
      else setDecided(true);
    });
    return () => {
      live = false;
    };
  }, [type, draftKey]);

  const save = useCallback(
    async (manual: boolean) => {
      if (!hasContent) return;
      setSaving(true);
      setError(null);
      const res = await saveDraftAction({ type, key: draftKey, title: title || null, payload: JSON.parse(snapshot) });
      setSaving(false);
      if (res.ok) {
        lastSaved.current = snapshot;
        setSavedAt(res.savedAt ?? new Date().toISOString());
      } else if (manual) setError(res.error ?? "Couldn't save the draft.");
    },
    [type, draftKey, title, snapshot, hasContent]
  );

  // Autosave a few seconds after the last change, once any earlier draft has been dealt with.
  useEffect(() => {
    if (!decided || !hasContent || snapshot === lastSaved.current) return;
    const t = setTimeout(() => void save(false), AUTOSAVE_MS);
    return () => clearTimeout(t);
  }, [snapshot, decided, hasContent, save]);

  async function discard() {
    await discardDraftAction({ type, key: draftKey });
    setExisting(null);
    setSavedAt(null);
    lastSaved.current = "";
    setDecided(true);
  }

  if (existing && !decided) {
    return (
      <div role="status" className="flex flex-wrap items-center gap-3 rounded-lg border border-[var(--info-border)] bg-[var(--info-soft)] px-4 py-3 text-sm">
        <FileClock className="h-4 w-4 shrink-0 text-[var(--info)]" aria-hidden />
        <p className="min-w-0 flex-1 text-secondary">
          You have a saved draft from <span className="font-medium text-primary">{ago(existing.updatedAt)}</span>. Pick up where you left off?
        </p>
        <button type="button" className="btn btn-primary btn-sm gap-1.5" onClick={() => { onRestore(existing.payload); lastSaved.current = JSON.stringify(existing.payload); setSavedAt(existing.updatedAt); setDecided(true); }}>
          <RotateCcw className="h-3.5 w-3.5" aria-hidden />Restore draft
        </button>
        <button type="button" className="btn btn-secondary btn-sm gap-1.5" onClick={discard}>
          <Trash2 className="h-3.5 w-3.5" aria-hidden />Start fresh
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-default bg-surface-subtle px-3 py-2 text-xs text-muted">
      <span className="flex items-center gap-1.5" aria-live="polite">
        {saving ? "Saving draft…" : savedAt ? <><CheckCircle2 className="h-3.5 w-3.5 text-[var(--success)]" aria-hidden />Draft saved {ago(savedAt)}</> : "Not saved yet. Your work is saved automatically as you go."}
        {note && <span className="text-subtle"> · {note}</span>}
      </span>
      <span className="flex items-center gap-2">
        {error && <span role="alert" className="text-[var(--error)]">{error}</span>}
        {savedAt && <button type="button" onClick={discard} className="text-muted hover:text-primary hover:underline">Discard draft</button>}
        <button type="button" onClick={() => void save(true)} disabled={!hasContent || saving} className="btn btn-secondary btn-sm gap-1.5">
          <Save className="h-3.5 w-3.5" aria-hidden />Save as draft
        </button>
      </span>
    </div>
  );
}
