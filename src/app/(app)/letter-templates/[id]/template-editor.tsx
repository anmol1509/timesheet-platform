"use client";

import { useActionState, useEffect, useMemo, useState, useTransition } from "react";
import { Copy, Eye, FileDown, RotateCcw, Trash2 } from "lucide-react";
import { LetterEditor } from "@/components/LetterEditor";
import { LetterPreview } from "@/components/LetterPreview";
import { fieldsFor, unknownFieldsIn, type Audience } from "@/lib/letterFields";
import { categoriesFor } from "@/lib/letterPresets";
import { deleteTemplateAction, duplicateTemplateAction, resetToPresetAction, saveTemplateAction } from "../actions";
import { Select } from "@/components/ui/Select";

type State = { error: string | null; ok?: boolean };
type Props = { id: string; audience: Audience; name: string; category: string; title: string; html: string; hasPreset: boolean; usedBy: number };

export function TemplateEditor(p: Props) {
  const [name, setName] = useState(p.name);
  const [category, setCategory] = useState(p.category);
  const [title, setTitle] = useState(p.title);
  const [html, setHtml] = useState(p.html);
  const [pdfBusy, setPdfBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [state, save, saving] = useActionState(saveTemplateAction, { error: null } as State);

  // Editor onChange only fires for real edits (not the initial load). An edit is "unsaved" until the next
  // save result arrives; a failed save keeps it unsaved.
  const [editedAt, setEditedAt] = useState<State | null>(null);
  const touched = editedAt === state || (editedAt !== null && !!state.error);
  const dirty = touched || name !== p.name || category !== p.category || title !== p.title;
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const fields = useMemo(() => fieldsFor(p.audience), [p.audience]);
  const unknown = useMemo(() => unknownFieldsIn(html, p.audience), [html, p.audience]);

  async function previewPdf() {
    setPdfBusy(true);
    setNote(null);
    try {
      const res = await fetch("/api/letter-templates/preview", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title: title || category, html, audience: p.audience }) });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? "Couldn't build the PDF.");
      window.open(URL.createObjectURL(await res.blob()), "_blank");
    } catch (e) {
      setNote(e instanceof Error ? e.message : "Couldn't build the PDF.");
    } finally {
      setPdfBusy(false);
    }
  }

  const run = (fn: (fd: FormData) => Promise<State | void>) =>
    start(async () => {
      setNote(null);
      const fd = new FormData();
      fd.set("id", p.id);
      const res = await fn(fd);
      if (res && res.error) setNote(res.error);
      else if (res && res.ok) window.location.reload();
    });

  const tb = "inline-flex h-8 items-center gap-1.5 rounded-md border border-default bg-surface px-2.5 text-xs font-medium text-secondary transition hover:bg-surface-hover disabled:opacity-50";

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]">
      <form action={save} className="min-w-0 space-y-4">
        <input type="hidden" name="id" value={p.id} />
        <input type="hidden" name="bodyHtml" value={html} />
        <div className="card space-y-3 p-4">
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-muted">Template name</span>
            <input name="name" value={name} onChange={(e) => setName(e.target.value)} required className="input w-full" />
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-muted">Letter type</span>
              <Select name="category" value={category} onChange={(v) => setCategory(v)} options={[{ value: "", label: "Not set" }, ...categoriesFor(p.audience).map((c) => ({ value: c, label: c }))]} triggerClassName="w-full" />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-muted">Heading printed on the letter</span>
              <input name="title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder={category || "e.g. Salary Certificate"} className="input w-full" />
            </label>
          </div>
        </div>

        <div className="space-y-2">
          <LetterEditor html={p.html} onChange={(h) => { setHtml(h); setEditedAt(state); }} fields={fields} audience={p.audience} />
          <p className="text-xs text-muted">
            {p.audience === "SITE"
              ? "Use Insert field for details filled in automatically, and Worker table to choose where the client's worker table prints — anything below it prints underneath."
              : "Use Insert field for the employee's details, and Ask when issuing for blanks the person issuing the letter fills in."}
          </p>
          {unknown.length > 0 && (
            <p role="alert" className="rounded-md border border-[var(--error-border)] bg-[var(--error-soft)] px-3 py-2 text-xs text-[var(--error)]">
              Not a real field: {unknown.map((u) => `%%${u}%%`).join(", ")} — it would print blank. Delete it or use Insert field.
            </p>
          )}
        </div>

        <div className="sticky bottom-0 z-10 -mx-1 flex flex-wrap items-center gap-2 border-t border-default bg-surface/95 px-1 py-3 backdrop-blur">
          <button type="submit" className="btn btn-primary" disabled={saving || !dirty || unknown.length > 0}>{saving ? "Saving…" : "Save changes"}</button>
          {dirty ? <span className="text-xs text-[var(--warning)]">Unsaved changes</span> : state.ok ? <span className="text-xs text-[var(--success)]">Saved</span> : null}
          {state.error && <span role="alert" className="text-xs text-[var(--danger-text,#b42318)]">{state.error}</span>}
          <span className="ml-auto flex flex-wrap gap-2">
            <button type="button" className={tb} onClick={previewPdf} disabled={pdfBusy}><FileDown className="h-3.5 w-3.5" aria-hidden /> {pdfBusy ? "Building…" : "Preview PDF"}</button>
            <button type="button" className={tb} disabled={pending} onClick={() => run(duplicateTemplateAction as unknown as (fd: FormData) => Promise<void>)}><Copy className="h-3.5 w-3.5" aria-hidden /> Duplicate</button>
            {p.hasPreset && <button type="button" className={tb} disabled={pending} onClick={() => { if (window.confirm("Replace this template's wording with the original?")) run(resetToPresetAction); }}><RotateCcw className="h-3.5 w-3.5" aria-hidden /> Reset to original</button>}
            <button type="button" className={tb} disabled={pending} onClick={() => { if (window.confirm(`Delete "${p.name}"?`)) run(deleteTemplateAction as unknown as (fd: FormData) => Promise<void>); }}><Trash2 className="h-3.5 w-3.5" aria-hidden /> Delete</button>
          </span>
        </div>
        {note && <p role="alert" className="text-sm text-[var(--danger-text,#b42318)]">{note}</p>}
        {p.usedBy > 0 && <p className="text-xs text-muted">Used by {p.usedBy} NOC{p.usedBy === 1 ? "" : "s"} — changes here will affect their next download.</p>}
      </form>

      <div className="min-w-0 xl:sticky xl:top-20 xl:self-start">
        <div className="mb-2 flex items-center gap-2 text-xs font-medium text-muted"><Eye className="h-3.5 w-3.5" aria-hidden /> Live preview <span className="font-normal">· sample data · blue = filled in automatically</span></div>
        <div className="rounded-lg bg-surface-sunken p-4"><LetterPreview title={title || category} html={html} audience={p.audience} /></div>
      </div>
    </div>
  );
}
