"use client";

import { useState, useTransition } from "react";
import { ImageUpload } from "@/components/ImageUpload";
import { removeSupplierLetterImageAction, saveSupplierSignatoryAction, uploadSupplierLetterImageAction } from "../actions";

/** Who signs letters issued for this company, and the signature and stamp printed when ticked on a letter. */
export function SupplierLettersSection({ supplierId, signatoryName, signatoryTitle, signatureUrl, stampUrl }: { supplierId: string; signatoryName: string; signatoryTitle: string; signatureUrl: string | null; stampUrl: string | null }) {
  const [name, setName] = useState(signatoryName);
  const [title, setTitle] = useState(signatoryTitle);
  const [pending, start] = useTransition();
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const extra = (kind: string) => ({ supplierId, kind });

  function save() {
    setMessage(null);
    const fd = new FormData();
    fd.set("supplierId", supplierId);
    fd.set("signatoryName", name);
    fd.set("signatoryTitle", title);
    start(async () => {
      try {
        const res = await saveSupplierSignatoryAction(fd);
        setMessage(res?.error ? { ok: false, text: res.error } : { ok: true, text: "Saved." });
      } catch {
        setMessage({ ok: false, text: "Couldn't save. Check your connection and try again." });
      }
    });
  }

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-muted">Signed by</span>
          <input value={name} onChange={(e) => setName(e.target.value)} maxLength={80} placeholder="e.g. Ahmed Khan" className="input w-full" />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-muted">Title</span>
          <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={80} placeholder="e.g. General Manager" className="input w-full" />
        </label>
      </div>
      <div className="flex items-center gap-3">
        <button type="button" className="btn btn-secondary" disabled={pending} onClick={save}>{pending ? "Saving…" : "Save signatory"}</button>
        {message && <span role="status" className={`text-sm ${message.ok ? "text-[var(--success)]" : "text-[var(--error)]"}`}>{message.text}</span>}
      </div>
      <ImageUpload
        currentUrl={signatureUrl}
        fallback={<span className="text-xs text-subtle">Signature</span>}
        label="Signature (optional)"
        hint="A PNG of the signature on a plain or transparent background. Only printed when you tick it on a letter."
        shape="square"
        format="image/png"
        maxPx={600}
        uploadAction={uploadSupplierLetterImageAction}
        removeAction={removeSupplierLetterImageAction}
        extraFields={extra("signature")}
      />
      <ImageUpload
        currentUrl={stampUrl}
        fallback={<span className="text-xs text-subtle">Stamp</span>}
        label="Company stamp (optional)"
        hint="A PNG of the round or square stamp, ideally transparent. Only printed when you tick it on a letter."
        shape="square"
        format="image/png"
        maxPx={500}
        uploadAction={uploadSupplierLetterImageAction}
        removeAction={removeSupplierLetterImageAction}
        extraFields={extra("stamp")}
      />
    </div>
  );
}
