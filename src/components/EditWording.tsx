"use client";

import { useState } from "react";
import { Pencil, RotateCcw } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/Dialog";
import { LetterEditor } from "@/components/LetterEditor";
import { fieldsFor, type Audience } from "@/lib/letterFields";
import { loadDocEditAction, resetDocEditAction, saveDocEditAction, type DocTarget } from "@/app/(platform)/(app)/doc-edit/actions";

import { Button } from "@/components/ui/Button";
/**
 * "Edit wording" for one document made from a template: opens the same editor the templates use (text, lists and tables),
 * on this document's wording. A change applies to this document only; the template is never touched, and the figures
 * still come from the records each time it is printed.
 */
export function EditWording({ target, label = "Edit wording", className, onChanged }: { target: DocTarget; label?: string; className?: string; onChanged?: () => void }) {
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<{ html: string; title: string; edited: boolean; audience: Audience; label: string } | null>(null);
  const [title, setTitle] = useState("");
  const [html, setHtml] = useState("");
  const [key, setKey] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function show() {
    setOpen(true);
    setError(null);
    setState(null);
    const r = await loadDocEditAction(target).catch(() => ({ error: "Couldn't open this document." }));
    if ("error" in r) { setError(r.error); return; }
    setState(r);
    setHtml(r.html);
    setTitle(r.title);
    setKey((n) => n + 1);
  }

  async function run(action: () => Promise<{ error: string | null }>) {
    setBusy(true);
    setError(null);
    const r = await action().catch(() => ({ error: "Something went wrong." }));
    setBusy(false);
    if (r.error) { setError(r.error); return; }
    setOpen(false);
    onChanged?.();
  }

  return (
    <>
      <button type="button" className={className ?? "inline-flex items-center gap-1 text-[var(--brand-primary)] hover:underline"} onClick={show}><Pencil className="h-3.5 w-3.5" aria-hidden /> {label}</button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent title={state ? `Edit wording · ${state.label}` : "Edit wording"} className="sm:max-w-4xl" description="Changes apply to this document only. The template is not changed, and the figures still come from the records each time it prints.">
          {error && !state ? <p role="alert" className="mt-4 text-sm text-[var(--error)]">{error}</p> : !state ? <div className="mt-4 h-72 animate-pulse rounded-lg bg-surface-sunken" /> : (
            <div className="mt-4 space-y-3">
              {state.edited && <p className="rounded-lg border border-[var(--warning-border)] bg-[var(--warning-soft)] px-3 py-2 text-xs text-secondary">This document already has its own wording. <b>Reset to template</b> goes back to the template&apos;s.</p>}
              <label className="block"><span className="mb-1 block text-xs font-medium text-muted">Heading printed on the document</span><input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} className="input w-full" aria-label="Heading" /></label>
              <LetterEditor key={key} html={html} onChange={setHtml} fields={fieldsFor(state.audience)} audience={state.audience} noAsk />
              {error && <p role="alert" className="text-sm text-[var(--error)]">{error}</p>}
              <div className="flex flex-wrap items-center gap-2">
                <Button size="btn" type="button" disabled={busy} onClick={() => run(() => saveDocEditAction(target, html, title))} loading={busy}>Save wording</Button>
                <button type="button" className="btn btn-secondary" disabled={busy} onClick={() => setOpen(false)}>Cancel</button>
                {state.edited && <button type="button" className="ml-auto inline-flex items-center gap-1 text-sm font-semibold text-brand hover:underline" disabled={busy} onClick={() => run(() => resetDocEditAction(target))}><RotateCcw className="h-3.5 w-3.5" aria-hidden /> Reset to template</button>}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
