"use client";

import { ImageUpload } from "@/components/ImageUpload";
import { PaperMargins } from "@/components/PaperMargins";
import type { Margins } from "@/lib/paperMargins";
import { removeLetterImageAction, saveLetterheadMarginsAction, savePlainMarginsAction, uploadLetterImageAction } from "./actions";

type Props = {
  branchId: string;
  signatoryName: string;
  signatoryTitle: string;
  signatureUrl: string | null;
  stampUrl: string | null;
  letterheadUrl: string | null;
  plain: Margins;
  letterhead: Margins;
};

export function LettersSection(p: Props) {
  const extra = (kind: string) => ({ branchId: p.branchId, kind });
  return (
    <div className="space-y-6">
      <div className="grid gap-5 sm:grid-cols-3">
      <ImageUpload
        stacked
        currentUrl={p.signatureUrl}
        fallback={<span className="text-xs text-subtle">Signature</span>}
        label="Signature (optional)"
        hint="PNG on a plain or transparent background. Printed only when ticked on a letter."
        shape="square"
        format="image/png"
        maxPx={600}
        uploadAction={uploadLetterImageAction}
        removeAction={removeLetterImageAction}
        extraFields={extra("signature")}
      />
      <ImageUpload
        stacked
        currentUrl={p.stampUrl}
        fallback={<span className="text-xs text-subtle">Stamp</span>}
        label="Company stamp (optional)"
        hint="PNG of the stamp, ideally transparent. Printed only when ticked on a letter."
        shape="square"
        format="image/png"
        maxPx={500}
        uploadAction={uploadLetterImageAction}
        removeAction={removeLetterImageAction}
        extraFields={extra("stamp")}
      />
      <ImageUpload
        stacked
        currentUrl={p.letterheadUrl}
        fallback={<span className="text-xs text-subtle">Letterhead</span>}
        label="Letterhead artwork (optional)"
        hint="PDF or image (first page used). Background when a letter is printed on letterhead. Skip for pre-printed paper."
        shape="square"
        format="image/jpeg"
        maxPx={1600}
        acceptPdf
        uploadAction={uploadLetterImageAction}
        removeAction={removeLetterImageAction}
        extraFields={extra("letterhead")}
      />
      </div>
      <div>
        <p className="mb-2 text-sm font-medium text-primary">Letter margins</p>
        <PaperMargins branchId={p.branchId} letterheadUrl={p.letterheadUrl} plain={p.plain} letterhead={p.letterhead} savePlain={savePlainMarginsAction} saveLetterhead={saveLetterheadMarginsAction} />
      </div>
    </div>
  );
}
