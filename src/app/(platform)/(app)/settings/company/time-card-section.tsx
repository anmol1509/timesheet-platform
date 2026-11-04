"use client";

import { useActionState, useEffect, useState } from "react";
import { ImageUpload } from "@/components/ImageUpload";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/Alert";
import { Select } from "@/components/ui/Select";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import type { TimeCardSpec } from "@/lib/timeCard";
import { removeLetterImageAction, resetTimeCardSpecAction, saveTimeCardSpecAction, uploadLetterImageAction } from "./actions";

type Props = { branchId: string; artworkUrl: string | null; spec: TimeCardSpec; custom: boolean; companies: { id: string; name: string; hasCard: boolean }[] };

const PREVIEW_MODES = [
  { value: "template", label: "The card drawn by the app (editable template)" },
  { value: "artwork", label: "On top of the default uploaded card" },
  { value: "overprint", label: "Values only (to print on the physical card)" },
];

function Text({ name, label, defaultValue, max = 40, className = "" }: { name: string; label: string; defaultValue: string; max?: number; className?: string }) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1 block text-xs font-medium text-muted">{label}</span>
      <input name={name} defaultValue={defaultValue} maxLength={max} className="input w-full" />
    </label>
  );
}

/**
 * The company's time card: the uploaded picture of the pre-printed card, the template the app draws it from, and the printer offset.
 * The three ways to print one are on the timesheet page; here they can be previewed with a made-up worker.
 */
export function TimeCardSection({ branchId, artworkUrl, spec, custom, companies }: Props) {
  const [state, action, pending] = useActionState(async (_p: { error: string | null; ok?: boolean }, fd: FormData) => saveTimeCardSpecAction(_p, fd), { error: null } as { error: string | null; ok?: boolean });
  const [mode, setMode] = useState(artworkUrl ? "artwork" : "template");
  const [version, setVersion] = useState(0);
  useEffect(() => { if (state.ok) setVersion((v) => v + 1); }, [state]);
  const month = new Date().toISOString().slice(0, 7);
  const src = `/api/timecards/pdf?preview=1&mode=${mode}&fill=full&inout=standard&pay=1&month=${month}&v=${version}#toolbar=0&navpanes=0`;
  const extra = { branchId, kind: "timecard" };

  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)]">
        <div className="space-y-6">
          <ImageUpload
            stacked
            currentUrl={artworkUrl}
            fallback={<span className="text-xs text-subtle">Time card</span>}
            label="Default time card (11.5 × 22 cm)"
            hint="For workers who have no company of their own. Each company keeps its own card under its Documents tab (below). A flat JPG or PNG scan of the blank card, upright and cropped to its edge."
            shape="square"
            format="image/jpeg"
            maxPx={2200}
            acceptPdf
            uploadAction={uploadLetterImageAction}
            removeAction={removeLetterImageAction}
            extraFields={extra}
          />

          <div>
            <p className="mb-2 text-xs font-semibold tracking-wide text-muted uppercase">Each company&apos;s own card</p>
            {companies.length === 0 ? (
              <p className="text-xs text-muted">No own companies yet.</p>
            ) : (
              <ul className="max-h-56 divide-y divide-[var(--border)] overflow-y-auto rounded-card border border-default">
                {companies.map((c) => (
                  <li key={c.id} className="flex items-center justify-between gap-3 px-3 py-1.5 text-sm">
                    <span className="min-w-0 truncate text-primary">{c.name}</span>
                    <span className="flex shrink-0 items-center gap-3 text-xs">
                      <span className={c.hasCard ? "text-[var(--success)]" : "text-[var(--warning)]"}>{c.hasCard ? "Card uploaded" : "No card yet"}</span>
                      <a href={`/suppliers/${c.id}`} className="font-medium text-[var(--brand-primary)] hover:underline">{c.hasCard ? "Open" : "Upload"}</a>
                    </span>
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-1 text-xs text-muted">On the company&apos;s page: Documents → Time card. Its name and logo on the template come from its own profile.</p>
          </div>

          <form action={action} className="space-y-5">
            <input type="hidden" name="branchId" value={branchId} />
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
                  <Text name="companyName" label="Company name (blank = from the company profile)" defaultValue={spec.companyName} max={80} />
                  <Text name="title" label="Title" defaultValue={spec.title} max={30} />
                  <Text name="contactLine" label="Contact line (blank = address, phone and email from the company profile)" defaultValue={spec.contactLine} max={160} className="sm:col-span-2" />
                  <label className="flex items-center gap-2 text-sm text-secondary sm:col-span-2"><input type="checkbox" name="showLogo" defaultChecked={spec.showLogo} /> Show the company logo</label>
                </div>
                <div>
                  <p className="mb-2 text-xs font-semibold tracking-wide text-muted uppercase">Field labels</p>
                  <div className="grid gap-3 sm:grid-cols-3">
                    {Object.entries(spec.labels).map(([k, v]) => <Text key={k} name={`labels.${k}`} label={k} defaultValue={v} />)}
                  </div>
                </div>
                <div>
                  <p className="mb-2 text-xs font-semibold tracking-wide text-muted uppercase">Table headings</p>
                  <div className="grid gap-3 sm:grid-cols-5">
                    {Object.entries(spec.headings).map(([k, v]) => <Text key={k} name={`headings.${k}`} label={k} defaultValue={v} max={12} />)}
                  </div>
                </div>
                <div>
                  <p className="mb-2 text-xs font-semibold tracking-wide text-muted uppercase">Totals box</p>
                  <div className="grid gap-3 sm:grid-cols-3">
                    {Object.entries(spec.totals).map(([k, v]) => <Text key={k} name={`totals.${k}`} label={k} defaultValue={v} max={36} />)}
                  </div>
                </div>
                <div>
                  <p className="mb-2 text-xs font-semibold tracking-wide text-muted uppercase">Signature lines</p>
                  <div className="grid gap-3 sm:grid-cols-3">
                    {spec.signatures.map((v, i) => <Text key={i} name={`signatures.${i}`} label={`Line ${i + 1}`} defaultValue={v} max={30} />)}
                  </div>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="block"><span className="mb-1 block text-xs font-medium text-muted">Line and text colour</span><input type="color" name="ink" defaultValue={spec.ink} className="h-9 w-full cursor-pointer rounded border border-default" /></label>
                  <label className="block"><span className="mb-1 block text-xs font-medium text-muted">Card colour (white saves ink)</span><input type="color" name="tint" defaultValue={spec.tint} className="h-9 w-full cursor-pointer rounded border border-default" /></label>
                </div>
              </div>
            </details>

            {state.error && <Alert>{state.error}</Alert>}
            <div className="flex flex-wrap items-center gap-3">
              <Button type="submit" size="btn" loading={pending}>Save time card settings</Button>
              {state.ok && <span className="text-xs text-[var(--success)]">Saved.</span>}
              {custom && (
                <ConfirmDialog
                  danger={false}
                  title="Reset the template?"
                  description="The card's wording, colours, shift times and printer offset go back to the defaults. Your uploaded card stays."
                  confirmLabel="Reset"
                  onConfirm={async () => { const fd = new FormData(); fd.set("branchId", branchId); const r = await resetTimeCardSpecAction(fd); if (r.error) return { error: r.error }; window.location.reload(); }}
                  trigger={(open) => <button type="button" className="text-xs font-medium text-[var(--error)] hover:underline" onClick={open}>Reset to defaults</button>}
                />
              )}
            </div>
          </form>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-medium text-muted">Preview with a made-up worker</p>
            <a href={src} target="_blank" rel="noreferrer" className="text-xs font-medium text-[var(--brand-primary)] hover:underline">Open in a new tab</a>
          </div>
          <Select value={mode} onChange={setMode} searchable={false} options={PREVIEW_MODES.filter((m) => m.value !== "artwork" || artworkUrl)} />
          <iframe key={`${mode}-${version}`} title="Time card preview" src={src} className="h-[620px] w-full rounded-card border border-default bg-white" />
        </div>
      </div>
    </div>
  );
}
