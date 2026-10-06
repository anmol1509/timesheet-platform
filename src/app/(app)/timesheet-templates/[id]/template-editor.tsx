"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { Loader2, Plus, RotateCcw, X } from "lucide-react";
import { saveTimesheetTemplateAction } from "../actions";
import { defaultConfig, MAX_SIGNATURES, type ColumnDef, type TemplateConfig } from "@/lib/timesheetTemplateConfig";
import type { TimesheetTemplateKey } from "@/lib/timesheetTemplates";
import { cn } from "@/lib/cn";

const HEADER_LABELS: [keyof TemplateConfig["header"], string][] = [
  ["logo", "Logo"], ["address", "Address"], ["phone", "Phone and fax"], ["email", "Email"], ["poBox", "P.O. Box"], ["trn", "TRN"],
  ["subContractor", "Sub-contractor"], ["issuedTo", "Issued to"], ["period", "Period dates"],
];
const BLOCK_LABELS: [keyof TemplateConfig["blocks"], string, string][] = [
  ["totals", "Totals box", "Gross amount, sub-total and total payable"],
  ["deductions", "Deductions", "Absence and gas lines"],
  ["vat", "VAT", "The VAT line (off = no VAT added)"],
  ["notes", "Notes", "The notes printed under the figures"],
];

function Check({ checked, onChange, label, hint, disabled }: { checked: boolean; onChange: (v: boolean) => void; label: string; hint?: string; disabled?: boolean }) {
  return (
    <label className={cn("flex items-start gap-2 text-sm", disabled && "opacity-50")}>
      <input type="checkbox" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} className="mt-0.5 h-4 w-4 accent-[var(--brand-primary)]" />
      <span><span className="text-primary">{label}</span>{hint && <span className="block text-xs text-muted">{hint}</span>}</span>
    </label>
  );
}

export function TemplateEditor({ id, name: initialName, baseKey, baseName, columns, initial }: { id: string; name: string; baseKey: TimesheetTemplateKey; baseName: string; columns: ColumnDef[]; initial: TemplateConfig }) {
  const [name, setName] = useState(initialName);
  const [cfg, setCfg] = useState<TemplateConfig>(initial);
  const [state, action, pending] = useActionState(saveTimesheetTemplateAction, { error: null });
  const [preview, setPreview] = useState<{ url: string | null; busy: boolean; error: string | null }>({ url: null, busy: true, error: null });
  const urlRef = useRef<string | null>(null);
  const standard = baseKey === "standard";
  const set = <K extends keyof TemplateConfig>(k: K, v: TemplateConfig[K]) => setCfg((c) => ({ ...c, [k]: v }));

  // The preview redraws shortly after the last change.
  useEffect(() => {
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      setPreview((p) => ({ ...p, busy: true, error: null }));
      try {
        const res = await fetch("/api/timesheet-templates/preview", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ baseKey, config: cfg, format: "pdf" }), signal: ctrl.signal });
        if (!res.ok) throw new Error((await res.json().catch(() => null))?.error ?? "The preview couldn't be drawn.");
        const url = URL.createObjectURL(await res.blob());
        if (urlRef.current) URL.revokeObjectURL(urlRef.current);
        urlRef.current = url;
        setPreview({ url, busy: false, error: null });
      } catch (e) {
        if ((e as Error).name !== "AbortError") setPreview((p) => ({ ...p, busy: false, error: e instanceof Error ? e.message : "The preview couldn't be drawn." }));
      }
    }, 700);
    return () => { clearTimeout(t); ctrl.abort(); };
  }, [cfg, baseKey]);
  useEffect(() => () => { if (urlRef.current) URL.revokeObjectURL(urlRef.current); }, []);

  return (
    <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,520px)_minmax(0,1fr)]">
      <form action={action} className="card space-y-6 p-5">
        <input type="hidden" name="id" value={id} />
        <input type="hidden" name="config" value={JSON.stringify(cfg)} />

        <div className="space-y-1">
          <label htmlFor="tpl-name" className="text-xs font-medium text-muted">Template name</label>
          <input id="tpl-name" name="name" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} required className="input w-full" />
          <p className="text-xs text-muted">Based on {baseName}. The name is what you pick when generating a sheet.</p>
        </div>

        <fieldset className="space-y-2">
          <legend className="text-sm font-semibold text-primary">Heading</legend>
          <input value={cfg.title} onChange={(e) => set("title", e.target.value)} maxLength={120} placeholder="Leave empty for the layout's own heading" className="input w-full" aria-label="Heading" />
        </fieldset>

        <fieldset className="space-y-2">
          <legend className="text-sm font-semibold text-primary">Header details</legend>
          <div className="grid grid-cols-2 gap-x-4 gap-y-2">
            {HEADER_LABELS.map(([k, label]) => (
              <Check key={k} checked={cfg.header[k]} onChange={(v) => setCfg((c) => ({ ...c, header: { ...c.header, [k]: v } }))} label={label} disabled={standard && (k === "subContractor" || k === "issuedTo" || k === "period")} />
            ))}
          </div>
          <p className="text-xs text-muted">The details themselves come from Settings → Company.</p>
        </fieldset>

        {!standard && (
          <fieldset className="space-y-2">
            <legend className="text-sm font-semibold text-primary">Columns</legend>
            <ul className="divide-y divide-[var(--border)] rounded-lg border border-default">
              {columns.map((col) => {
                const shown = !cfg.hiddenColumns.includes(col.key);
                return (
                  <li key={col.key} className="flex items-center gap-3 px-3 py-2">
                    <input type="checkbox" checked={shown} disabled={col.required} aria-label={`Show ${col.label}`} onChange={(e) => set("hiddenColumns", e.target.checked ? cfg.hiddenColumns.filter((k) => k !== col.key) : [...cfg.hiddenColumns, col.key])} className="h-4 w-4 accent-[var(--brand-primary)]" />
                    <input value={cfg.headings[col.key] ?? ""} onChange={(e) => { const v = e.target.value; setCfg((c) => { const h = { ...c.headings }; if (v) h[col.key] = v; else delete h[col.key]; return { ...c, headings: h }; }); }} maxLength={60} placeholder={col.label} disabled={!shown} className="input flex-1 px-2 py-1 text-sm" aria-label={`Heading for ${col.label}`} />
                    {col.required && <span className="text-xs text-muted">always shown</span>}
                  </li>
                );
              })}
            </ul>
            <p className="text-xs text-muted">Tick to show a column; type to use your own wording.</p>
          </fieldset>
        )}

        <fieldset className="space-y-2">
          <legend className="text-sm font-semibold text-primary">Figures</legend>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {BLOCK_LABELS.filter(([k]) => !(baseKey === "signoff" && k !== "notes")).map(([k, label, hint]) => (
              <Check key={k} checked={cfg.blocks[k]} onChange={(v) => setCfg((c) => ({ ...c, blocks: { ...c.blocks, [k]: v } }))} label={label} hint={hint} />
            ))}
          </div>
          {baseKey !== "signoff" && (
            <div className="flex items-center gap-2 pt-1">
              <label htmlFor="tpl-vat" className="text-sm text-primary">VAT %</label>
              <input id="tpl-vat" type="number" min={0} max={100} step="0.01" value={cfg.vatPercent ?? ""} onChange={(e) => set("vatPercent", e.target.value === "" ? null : Math.min(100, Math.max(0, Number(e.target.value))))} placeholder="5" className="input w-24 px-2 py-1 text-sm" />
              <span className="text-xs text-muted">Empty uses the standard 5%.</span>
            </div>
          )}
        </fieldset>

        <fieldset className="space-y-2">
          <legend className="text-sm font-semibold text-primary">Notes</legend>
          <textarea value={cfg.notes} onChange={(e) => set("notes", e.target.value)} rows={5} maxLength={3000} placeholder={standard ? "One note per line. Empty keeps the standard payment notes." : "One paragraph per line, printed under the figures."} className="input w-full" aria-label="Notes" />
        </fieldset>

        <fieldset className="space-y-2">
          <legend className="text-sm font-semibold text-primary">Signature boxes</legend>
          <ul className="space-y-2">
            {cfg.signatures.map((label, i) => (
              <li key={i} className="flex items-center gap-2">
                <input value={label} onChange={(e) => set("signatures", cfg.signatures.map((x, j) => (j === i ? e.target.value : x)))} maxLength={60} className="input flex-1 px-2 py-1 text-sm" aria-label={`Signature box ${i + 1}`} />
                <button type="button" onClick={() => set("signatures", cfg.signatures.filter((_, j) => j !== i))} aria-label={`Remove box ${i + 1}`} className="rounded p-1 text-muted hover:bg-surface-hover"><X className="h-4 w-4" aria-hidden /></button>
              </li>
            ))}
          </ul>
          {cfg.signatures.length < MAX_SIGNATURES && (
            <button type="button" onClick={() => set("signatures", [...cfg.signatures, "Approved by"])} className="btn btn-secondary btn-sm gap-1.5"><Plus className="h-3.5 w-3.5" aria-hidden />Add a box</button>
          )}
          {cfg.signatures.length === 0 && <p className="text-xs text-muted">No signature boxes will be printed.</p>}
        </fieldset>

        <fieldset className="space-y-2">
          <legend className="text-sm font-semibold text-primary">Footer</legend>
          <input value={cfg.footer} onChange={(e) => set("footer", e.target.value)} maxLength={160} placeholder="Printed at the foot of every page; empty uses the company name" className="input w-full" aria-label="Footer" />
        </fieldset>

        {state.error && <p role="alert" className="text-sm text-[var(--error)]">{state.error}</p>}
        {state.ok && !state.error && <p role="status" className="text-sm text-[var(--success)]">Saved.</p>}
        <div className="flex flex-wrap items-center gap-3 border-t border-default pt-4">
          <button type="submit" disabled={pending || !name.trim()} className="btn btn-primary">{pending ? "Saving…" : "Save template"}</button>
          <button type="button" onClick={() => { setCfg(defaultConfig(baseKey)); }} className="btn btn-secondary gap-1.5"><RotateCcw className="h-4 w-4" aria-hidden />Reset to original</button>
        </div>
      </form>

      <div className="card flex min-h-[520px] flex-col p-3 xl:sticky xl:top-4 xl:h-[calc(100vh-7rem)]">
        <div className="flex items-center justify-between px-2 pb-2">
          <p className="text-sm font-semibold text-primary">Preview</p>
          <span className="flex items-center gap-1.5 text-xs text-muted">{preview.busy && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />}{preview.busy ? "Updating…" : "Made-up workers"}</span>
        </div>
        {preview.error ? <p className="p-4 text-sm text-[var(--error)]">{preview.error}</p> : preview.url ? <iframe title="Template preview" src={`${preview.url}#toolbar=0&navpanes=0`} className="min-h-0 flex-1 rounded-md border border-default bg-white" /> : <div className="flex flex-1 items-center justify-center text-sm text-muted">Drawing the preview…</div>}
      </div>
    </div>
  );
}
