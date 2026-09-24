"use client";

import { useActionState, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { Bold, Copy, Eye, FileDown, List, RotateCcw, Trash2 } from "lucide-react";
import * as Popover from "@radix-ui/react-popover";
import { LetterPreview } from "@/components/LetterPreview";
import { LETTER_MERGE_FIELDS } from "@/lib/letterLayout";
import { LETTER_CATEGORIES } from "@/lib/letterPresets";
import { deleteTemplateAction, duplicateTemplateAction, resetToPresetAction, saveTemplateAction } from "../actions";

type State = { error: string | null; ok?: boolean };
type Props = { id: string; name: string; category: string; title: string; body: string; hasPreset: boolean; usedBy: number };

// Fields worth showing as chips; the older alias is still accepted but not offered.
const FIELDS = LETTER_MERGE_FIELDS.filter((f) => f.key !== "SPONSORSHIPCOMPANYNAME");

export function TemplateEditor(p: Props) {
  const [name, setName] = useState(p.name);
  const [category, setCategory] = useState(p.category);
  const [title, setTitle] = useState(p.title);
  const [body, setBody] = useState(p.body);
  const ta = useRef<HTMLTextAreaElement>(null);
  const [fieldsOpen, setFieldsOpen] = useState(false);
  const [pdfBusy, setPdfBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [state, save, saving] = useActionState(saveTemplateAction, { error: null } as State);

  const dirty = name !== p.name || category !== p.category || title !== p.title || body !== p.body;
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const known = useMemo(() => new Set(LETTER_MERGE_FIELDS.map((f) => f.key)), []);
  const unknown = useMemo(() => [...new Set([...body.matchAll(/%%(\w+)%%/g)].map((m) => m[1]).filter((k) => !known.has(k)))], [body, known]);
  const used = useMemo(() => new Set([...body.matchAll(/%%(\w+)%%/g)].map((m) => m[1])), [body]);

  /** Replaces the current selection, keeping the caret sensible. */
  function edit(fn: (sel: string, before: string, after: string) => { text: string; select?: [number, number] }) {
    const el = ta.current;
    if (!el) return;
    const s = el.selectionStart, e = el.selectionEnd;
    const r = fn(body.slice(s, e), body.slice(0, s), body.slice(e));
    const next = body.slice(0, s) + r.text + body.slice(e);
    setBody(next);
    requestAnimationFrame(() => {
      el.focus();
      const [from, to] = r.select ?? [r.text.length, r.text.length];
      el.setSelectionRange(s + from, s + to);
    });
  }
  const insertField = (key: string) => { edit(() => ({ text: `%%${key}%%` })); setFieldsOpen(false); };
  const bold = () => edit((sel) => (sel ? { text: `**${sel}**` } : { text: "****", select: [2, 2] }));
  const bullets = () => {
    const el = ta.current;
    if (!el) return;
    const s = el.selectionStart, e = el.selectionEnd;
    const start = body.lastIndexOf("\n", s - 1) + 1;
    const endIdx = body.indexOf("\n", e);
    const end = endIdx === -1 ? body.length : endIdx;
    const lines = body.slice(start, end).split("\n");
    const all = lines.every((l) => /^- /.test(l) || !l.trim());
    const out = lines.map((l) => (!l.trim() ? l : all ? l.replace(/^- /, "") : /^- /.test(l) ? l : `- ${l}`)).join("\n");
    setBody(body.slice(0, start) + out + body.slice(end));
  };

  async function previewPdf() {
    setPdfBusy(true);
    setNote(null);
    try {
      const res = await fetch("/api/letter-templates/preview", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title: title || category, body }) });
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
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <form action={save} className="space-y-4">
        <input type="hidden" name="id" value={p.id} />
        <input type="hidden" name="body" value={body} />
        <div className="card space-y-3 p-4">
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-muted">Template name</span>
            <input name="name" value={name} onChange={(e) => setName(e.target.value)} required className="input w-full" />
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-muted">Letter type</span>
              <select name="category" value={category} onChange={(e) => setCategory(e.target.value)} className="input w-full">
                <option value="">Not set</option>
                {LETTER_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-muted">Heading printed on the letter</span>
              <input name="title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder={category || "e.g. No Objection Certificate"} className="input w-full" />
            </label>
          </div>
        </div>

        <div className="card p-4">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <button type="button" className={tb} onClick={bold} title="Bold (wraps the selection in **)"><Bold className="h-3.5 w-3.5" aria-hidden /> Bold</button>
            <button type="button" className={tb} onClick={bullets} title="Turn the selected lines into a bullet list"><List className="h-3.5 w-3.5" aria-hidden /> Bullets</button>
            <Popover.Root open={fieldsOpen} onOpenChange={setFieldsOpen}>
              <Popover.Trigger asChild>
                <button type="button" className={`${tb} border-[var(--brand-primary)] text-[var(--brand-primary)]`}>+ Insert field</button>
              </Popover.Trigger>
              <Popover.Portal>
                <Popover.Content align="start" sideOffset={6} className="rx-popover z-50 max-h-80 w-72 overflow-y-auto rounded-card border border-default bg-surface p-1 shadow-popover">
                  {FIELDS.map((f) => (
                    <button key={f.key} type="button" onClick={() => insertField(f.key)} className="block w-full rounded-sm px-2.5 py-1.5 text-left transition hover:bg-surface-hover">
                      <span className="block text-sm text-primary">{f.label}</span>
                      <span className="block truncate text-xs text-muted">e.g. {f.example}</span>
                    </button>
                  ))}
                </Popover.Content>
              </Popover.Portal>
            </Popover.Root>
          </div>
          <textarea
            ref={ta}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={16}
            aria-label="Letter body"
            className="input w-full font-mono text-[13px] leading-relaxed"
          />
          <p className="mt-1.5 text-xs text-muted">
            New line = new paragraph. <code className="rounded bg-surface-sunken px-1">**bold**</code>, <code className="rounded bg-surface-sunken px-1">- bullet</code>. Fields like <code className="rounded bg-surface-sunken px-1">%%CLIENTNAME%%</code> are filled in when the letter is made.
          </p>
          <div className="mt-3 flex flex-wrap gap-1.5" aria-label="Fields">
            {FIELDS.map((f) => (
              <button key={f.key} type="button" onClick={() => insertField(f.key)} title={`Insert — e.g. ${f.example}`}
                className={`rounded-full border px-2.5 py-1 text-xs transition hover:bg-surface-hover ${used.has(f.key) ? "border-[var(--brand-primary)] bg-brand-soft text-[var(--brand-primary)]" : "border-default text-secondary"}`}>
                {f.label}
              </button>
            ))}
          </div>
          {unknown.length > 0 && (
            <p role="alert" className="mt-3 rounded-md border border-[var(--error-border)] bg-[var(--error-soft)] px-3 py-2 text-xs text-[var(--error)]">
              Not a real field: {unknown.map((u) => `%%${u}%%`).join(", ")} — it would print blank. Use the buttons above.
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

      <div className="lg:sticky lg:top-20 lg:self-start">
        <div className="mb-2 flex items-center gap-2 text-xs font-medium text-muted"><Eye className="h-3.5 w-3.5" aria-hidden /> Live preview <span className="font-normal">· blue = filled in automatically, sample data shown</span></div>
        <div className="rounded-lg bg-surface-sunken p-4"><LetterPreview title={title || category} body={body} /></div>
      </div>
    </div>
  );
}
