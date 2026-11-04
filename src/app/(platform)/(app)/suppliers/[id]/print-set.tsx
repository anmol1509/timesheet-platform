"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Upload } from "lucide-react";
import { Alert } from "@/components/Alert";
import { Select } from "@/components/ui/Select";
import { TimeCardTemplateForm } from "@/components/TimeCardTemplateForm";
import { uploadAttachment } from "@/lib/uploadAttachment";
import { MAX_UPLOAD_LABEL } from "@/lib/constants";
import type { TimeCardSpec } from "@/lib/timeCard";
import { resetCompanyTimeCardSpecAction, saveCompanyTimeCardSpecAction } from "../time-card-actions";

type Props = {
  supplierId: string;
  canEdit: boolean;
  hasLetterhead: boolean;
  hasCard: boolean;
  /** The template in force for this company: its own, or the shared one. */
  spec: TimeCardSpec;
  ownTemplate: boolean;
  /** The letterhead margins editor, shown under the letterhead once there is one. */
  margins: React.ReactNode;
};

const MODES = [
  { value: "template", label: "The card drawn by the app (template)" },
  { value: "artwork", label: "On top of this company's uploaded card" },
  { value: "overprint", label: "The writing only (for the physical card)" },
];

/** One upload tile: shows what is on file and takes a replacement. */
function FileTile({ title, hint, previewUrl, has, docType, supplierId, canEdit, accept }: { title: string; hint: string; previewUrl: string; has: boolean; docType: string; supplierId: string; canEdit: boolean; accept: string }) {
  const input = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [broken, setBroken] = useState(false);
  function pick(file: File | undefined) {
    if (!file) return;
    setError(null);
    start(async () => {
      const fd = new FormData();
      fd.set("entityType", "SUPPLIER"); fd.set("entityId", supplierId); fd.set("revalidate", `/suppliers/${supplierId}`);
      fd.set("docType", docType); fd.set("file", file); fd.set("expiryDate", "");
      const res = await uploadAttachment(fd);
      if (res?.error) setError(res.error);
      else { setBroken(false); router.refresh(); }
      if (input.current) input.current.value = "";
    });
  }
  return (
    <div className="space-y-2 rounded-card border border-default p-3">
      <div className="flex items-start gap-3">
        <div className="flex h-24 w-16 shrink-0 items-center justify-center overflow-hidden rounded border border-default bg-surface-sunken">
          {has && !broken ? (
            // eslint-disable-next-line @next/next/no-img-element -- a stored blank, shown small
            <img src={`${previewUrl}?v=${has ? "1" : "0"}`} alt={`${title} on file`} className="h-full w-full object-cover" onError={() => setBroken(true)} />
          ) : (
            <span className="px-1 text-center text-[10px] text-subtle">{has ? "On file" : "None"}</span>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-primary">{title}</p>
          <p className="text-xs text-muted">{hint}</p>
          <p className={`mt-1 text-xs ${has ? "text-[var(--success)]" : "text-[var(--warning)]"}`}>{has ? "On file" : "Not uploaded yet"}</p>
          {canEdit && (
            <>
              <input ref={input} type="file" accept={accept} className="hidden" onChange={(e) => pick(e.target.files?.[0])} />
              <button type="button" disabled={pending} onClick={() => input.current?.click()} className="btn btn-secondary btn-sm mt-2 inline-flex items-center gap-1.5">
                <Upload className="h-3.5 w-3.5" aria-hidden /> {pending ? "Uploading…" : has ? "Replace" : "Upload"}
              </button>
            </>
          )}
        </div>
      </div>
      {error && <Alert>{error}</Alert>}
    </div>
  );
}

/** An own company's letterhead and time card together: what is on file, its template, and a preview of the card. */
export function PrintSet({ supplierId, canEdit, hasLetterhead, hasCard, spec, ownTemplate, margins }: Props) {
  const [mode, setMode] = useState(hasCard ? "artwork" : "template");
  const [version, setVersion] = useState(0);
  const [editing, setEditing] = useState(false);
  const month = new Date().toISOString().slice(0, 7);
  const src = `/api/timecards/pdf?preview=1&companyId=${supplierId}&mode=${mode}&fill=full&inout=standard&pay=1&month=${month}&v=${version}#toolbar=0&navpanes=0`;

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <FileTile title="Letterhead" hint={`Blank letterhead for letters and NOCs issued as this company (PDF, JPG or PNG, up to ${MAX_UPLOAD_LABEL}).`} previewUrl={`/api/suppliers/${supplierId}/letterhead`} has={hasLetterhead} docType="LETTERHEAD" supplierId={supplierId} canEdit={canEdit} accept=".pdf,.jpg,.jpeg,.png" />
        <FileTile title="Time card (11.5 × 22 cm)" hint="The blank pre-printed card, as a flat JPG or PNG scan, upright and cropped to the card's edge." previewUrl={`/api/suppliers/${supplierId}/time-card`} has={hasCard} docType="TIME_CARD" supplierId={supplierId} canEdit={canEdit} accept=".jpg,.jpeg,.png" />
      </div>
      {hasLetterhead && margins}

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,20rem)]">
        <div className="space-y-3">
          <div className="rounded-card border border-default p-3">
            <p className="text-sm font-medium text-primary">{ownTemplate ? "This company has its own time card template" : "This company uses the shared time card template"}</p>
            <p className="mt-0.5 text-xs text-muted">{ownTemplate ? "Its wording, colours, shift times and printer offset are its own." : "The wording, colours, shift times and printer offset set in Company profile. Its name, address and logo come from this company."}</p>
            {canEdit && !editing && (
              <button type="button" className="btn btn-secondary btn-sm mt-2" onClick={() => setEditing(true)}>{ownTemplate ? "Edit its template" : "Give it its own template"}</button>
            )}
          </div>
          {editing && canEdit && (
            <TimeCardTemplateForm
              spec={spec}
              custom={ownTemplate}
              hidden={{ supplierId }}
              save={saveCompanyTimeCardSpecAction}
              reset={resetCompanyTimeCardSpecAction}
              onSaved={() => setVersion((v) => v + 1)}
              saveLabel="Save this company's template"
              resetNote="This company goes back to the shared template from Company profile."
            />
          )}
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-medium text-muted">Preview with a made-up worker</p>
            <a href={src} target="_blank" rel="noreferrer" className="text-xs font-medium text-[var(--brand-primary)] hover:underline">Open in a new tab</a>
          </div>
          <Select value={mode} onChange={setMode} searchable={false} options={MODES.filter((m) => m.value !== "artwork" || hasCard)} />
          <iframe key={`${mode}-${version}`} title="Time card preview" src={src} className="h-[520px] w-full rounded-card border border-default bg-white" />
        </div>
      </div>
    </div>
  );
}
