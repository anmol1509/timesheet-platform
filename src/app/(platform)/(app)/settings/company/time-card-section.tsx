"use client";

import { useState } from "react";
import { ImageUpload } from "@/components/ImageUpload";
import { Select } from "@/components/ui/Select";
import { TimeCardTemplateForm } from "@/components/TimeCardTemplateForm";
import type { TimeCardSpec } from "@/lib/timeCard";
import { removeLetterImageAction, resetTimeCardSpecAction, saveTimeCardSpecAction, uploadLetterImageAction } from "./actions";

type Props = { branchId: string; artworkUrl: string | null; spec: TimeCardSpec; custom: boolean; companies: { id: string; name: string; hasCard: boolean; hasLetterhead: boolean; ownTemplate: boolean }[] };

const PREVIEW_MODES = [
  { value: "template", label: "The card drawn by the app (editable template)" },
  { value: "artwork", label: "On top of the default uploaded card" },
  { value: "overprint", label: "Values only (to print on the physical card)" },
];

/**
 * The company's time card: the uploaded picture of the pre-printed card, the template the app draws it from, and the printer offset.
 * The three ways to print one are on the timesheet page; here they can be previewed with a made-up worker.
 */
export function TimeCardSection({ branchId, artworkUrl, spec, custom, companies }: Props) {
  const [mode, setMode] = useState(artworkUrl ? "artwork" : "template");
  const [version, setVersion] = useState(0);
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
            hint="Only for workers who have no company of their own. Each company keeps its own card on its own page. A flat JPG or PNG scan of the blank card, upright and cropped to its edge."
            shape="square"
            format="image/jpeg"
            maxPx={2200}
            acceptPdf
            uploadAction={uploadLetterImageAction}
            removeAction={removeLetterImageAction}
            extraFields={extra}
          />

          <div>
            <p className="mb-2 text-xs font-semibold tracking-wide text-muted uppercase">Letterhead and time card, company by company</p>
            {companies.length === 0 ? (
              <p className="text-xs text-muted">No own companies yet.</p>
            ) : (
              <div className="max-h-64 overflow-y-auto rounded-card border border-default">
                <table className="w-full text-xs">
                  <thead className="sticky top-0 bg-surface-subtle text-left text-muted"><tr><th className="px-3 py-1.5 font-medium">Company</th><th className="px-2 py-1.5 font-medium">Letterhead</th><th className="px-2 py-1.5 font-medium">Time card</th><th className="px-2 py-1.5 font-medium">Template</th><th /></tr></thead>
                  <tbody className="divide-y divide-[var(--border)]">
                    {companies.map((c) => (
                      <tr key={c.id}>
                        <td className="max-w-[12rem] truncate px-3 py-1.5 text-sm text-primary">{c.name}</td>
                        <td className={`px-2 py-1.5 ${c.hasLetterhead ? "text-[var(--success)]" : "text-[var(--warning)]"}`}>{c.hasLetterhead ? "On file" : "Missing"}</td>
                        <td className={`px-2 py-1.5 ${c.hasCard ? "text-[var(--success)]" : "text-[var(--warning)]"}`}>{c.hasCard ? "On file" : "Missing"}</td>
                        <td className="px-2 py-1.5 text-muted">{c.ownTemplate ? "Its own" : "Shared"}</td>
                        <td className="px-2 py-1.5 text-right"><a href={`/suppliers/${c.id}#print`} className="font-medium text-[var(--brand-primary)] hover:underline">Open</a></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <p className="mt-1 text-xs text-muted">Each company&apos;s files and template are on its own page, under &ldquo;Letterhead and time card&rdquo;. The template below is the shared one every company starts from.</p>
          </div>

          <TimeCardTemplateForm
            spec={spec}
            custom={custom}
            hidden={{ branchId }}
            save={saveTimeCardSpecAction}
            reset={resetTimeCardSpecAction}
            onSaved={() => setVersion((v) => v + 1)}
            resetNote="The shared template's wording, colours, shift times and printer offset go back to the defaults. Companies with their own template keep it."
          />
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
