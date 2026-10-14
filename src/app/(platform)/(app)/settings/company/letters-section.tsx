"use client";

import { ImageUpload } from "@/components/ImageUpload";
import { LetterheadMargins } from "@/components/LetterheadMargins";
import { removeLetterImageAction, saveLetterheadMarginsAction, uploadLetterImageAction } from "./actions";

type Props = {
  branchId: string;
  signatoryName: string;
  signatoryTitle: string;
  signatureUrl: string | null;
  stampUrl: string | null;
  letterheadUrl: string | null;
  topMm: number;
  bottomMm: number;
};

export function LettersSection(p: Props) {
  const extra = (kind: string) => ({ branchId: p.branchId, kind });
  return (
    <div className="space-y-6">
      <ImageUpload
        currentUrl={p.signatureUrl}
        fallback={<span className="text-xs text-subtle">Signature</span>}
        label="Signature (optional)"
        hint="A PNG of the signature on a plain or transparent background. Only printed when you tick it on a letter."
        shape="square"
        format="image/png"
        maxPx={600}
        uploadAction={uploadLetterImageAction}
        removeAction={removeLetterImageAction}
        extraFields={extra("signature")}
      />
      <ImageUpload
        currentUrl={p.stampUrl}
        fallback={<span className="text-xs text-subtle">Stamp</span>}
        label="Company stamp (optional)"
        hint="A PNG of the round or square stamp, ideally transparent. Only printed when you tick it on a letter."
        shape="square"
        format="image/png"
        maxPx={500}
        uploadAction={uploadLetterImageAction}
        removeAction={removeLetterImageAction}
        extraFields={extra("stamp")}
      />
      <ImageUpload
        currentUrl={p.letterheadUrl}
        fallback={<span className="text-xs text-subtle">Letterhead</span>}
        label="Letterhead artwork (optional)"
        hint="Upload your letterhead as a PDF or an image (the first page of a PDF is used). Used as the page background when a letter is printed on letterhead. Skip this if you print on pre-printed paper."
        shape="square"
        format="image/jpeg"
        maxPx={1600}
        acceptPdf
        uploadAction={uploadLetterImageAction}
        removeAction={removeLetterImageAction}
        extraFields={extra("letterhead")}
      />
      <div>
        <p className="mb-2 text-sm font-medium text-primary">Letterhead margins</p>
        <LetterheadMargins letterheadUrl={p.letterheadUrl} topMm={p.topMm} bottomMm={p.bottomMm} action={saveLetterheadMarginsAction} extraFields={{ branchId: p.branchId }} />
      </div>
    </div>
  );
}
