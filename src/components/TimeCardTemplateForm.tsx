"use client";

import { useActionState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/Alert";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import type { TimeCardSpec } from "@/lib/timeCard";

type State = { error: string | null; ok?: boolean };

function Text({ name, label, defaultValue, max = 40, className = "" }: { name: string; label: string; defaultValue: string; max?: number; className?: string }) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1 block text-xs font-medium text-muted">{label}</span>
      <input name={name} defaultValue={defaultValue} maxLength={max} className="input w-full" />
    </label>
  );
}

/**
 * The editable time card: the standard shift, the printer offset, and the template the app draws the card from (texts, headings,
 * totals, signature lines, colours, logo). Used for the company profile's shared template and for one company's own.
 * `hidden` carries whatever the save action needs to know which one it is saving.
 */
export function TimeCardTemplateForm({ spec, custom, hidden, save, reset, onSaved, saveLabel = "Save time card settings", resetNote }: {
  spec: TimeCardSpec;
  custom: boolean;
  hidden: Record<string, string>;
  save: (prev: State, fd: FormData) => Promise<State>;
  reset?: (fd: FormData) => Promise<{ error?: string | null }>;
  onSaved?: () => void;
  saveLabel?: string;
  /** What resetting does, in words. */
  resetNote?: string;
}) {
  const [state, action, pending] = useActionState(save, { error: null } as State);
  // Tell the screen once per save. The callback is a new function on every render, so it must not be a dependency: that
  // re-ran this on each render and, through the preview's version counter, requested the PDF again and again.
  const saved = useRef(onSaved);
  useEffect(() => { saved.current = onSaved; }, [onSaved]);
  useEffect(() => { if (state.ok) saved.current?.(); }, [state]);
  return (
    <form action={action} className="space-y-5">
      {Object.entries(hidden).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
      <div className="grid gap-4 sm:grid-cols-2">
        <Text name="shiftIn" label="Standard shift: in (printed when asked)" defaultValue={spec.shiftIn} max={5} />
        <Text name="shiftOut" label="Standard shift: out" defaultValue={spec.shiftOut} max={5} />
        <Text name="offsetXmm" label="Printer offset: right (mm, − for left)" defaultValue={String(spec.offsetXmm)} max={5} />
        <Text name="offsetYmm" label="Printer offset: down (mm, − for up)" defaultValue={String(spec.offsetYmm)} max={5} />
      </div>
      <p className="-mt-2 text-xs text-muted">The offset only moves what is printed onto the physical card. Print one test card, see how far the writing is from its boxes, and enter the difference here.</p>

      <details className="rounded-card border border-default" open={custom}>
        <summary className="cursor-pointer px-3 py-2 text-sm font-medium text-primary">Edit the template (the card the app draws)</summary>
        <div className="space-y-5 border-t border-default p-3">
          <div className="grid gap-4 sm:grid-cols-2">
            <Text name="companyName" label="Company name (blank = from the company's own profile)" defaultValue={spec.companyName} max={80} />
            <Text name="title" label="Title" defaultValue={spec.title} max={30} />
            <Text name="contactLine" label="Contact line (blank = address, phone and email from the profile)" defaultValue={spec.contactLine} max={160} className="sm:col-span-2" />
            <label className="flex items-center gap-2 text-sm text-secondary sm:col-span-2"><input type="checkbox" name="showLogo" defaultChecked={spec.showLogo} /> Show the company logo</label>
          </div>
          <div>
            <p className="mb-2 text-xs font-semibold tracking-wide text-muted uppercase">Field labels</p>
            <div className="grid gap-3 sm:grid-cols-3">{Object.entries(spec.labels).map(([k, v]) => <Text key={k} name={`labels.${k}`} label={k} defaultValue={v} />)}</div>
          </div>
          <div>
            <p className="mb-2 text-xs font-semibold tracking-wide text-muted uppercase">Table headings</p>
            <div className="grid gap-3 sm:grid-cols-5">{Object.entries(spec.headings).map(([k, v]) => <Text key={k} name={`headings.${k}`} label={k} defaultValue={v} max={12} />)}</div>
          </div>
          <div>
            <p className="mb-2 text-xs font-semibold tracking-wide text-muted uppercase">Totals box</p>
            <div className="grid gap-3 sm:grid-cols-3">{Object.entries(spec.totals).map(([k, v]) => <Text key={k} name={`totals.${k}`} label={k} defaultValue={v} max={36} />)}</div>
          </div>
          <div>
            <p className="mb-2 text-xs font-semibold tracking-wide text-muted uppercase">Signature lines</p>
            <div className="grid gap-3 sm:grid-cols-3">{spec.signatures.map((v, i) => <Text key={i} name={`signatures.${i}`} label={`Line ${i + 1}`} defaultValue={v} max={30} />)}</div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block"><span className="mb-1 block text-xs font-medium text-muted">Line and text colour</span><input type="color" name="ink" defaultValue={spec.ink} className="h-9 w-full cursor-pointer rounded border border-default" /></label>
            <label className="block"><span className="mb-1 block text-xs font-medium text-muted">Card colour (white saves ink)</span><input type="color" name="tint" defaultValue={spec.tint} className="h-9 w-full cursor-pointer rounded border border-default" /></label>
          </div>
        </div>
      </details>

      {state.error && <Alert>{state.error}</Alert>}
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" size="btn" loading={pending}>{saveLabel}</Button>
        {state.ok && <span className="text-xs text-[var(--success)]">Saved.</span>}
        {custom && reset && (
          <ConfirmDialog
            danger={false}
            title="Reset the template?"
            description={resetNote ?? "The card's wording, colours, shift times and printer offset go back to the defaults."}
            confirmLabel="Reset"
            onConfirm={async () => { const fd = new FormData(); for (const [k, v] of Object.entries(hidden)) fd.set(k, v); const r = await reset(fd); if (r.error) return { error: r.error }; window.location.reload(); }}
            trigger={(open) => <button type="button" className="text-xs font-medium text-[var(--error)] hover:underline" onClick={open}>Reset</button>}
          />
        )}
      </div>
    </form>
  );
}
