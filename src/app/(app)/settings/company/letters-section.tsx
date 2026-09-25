"use client";

import { useActionState } from "react";
import { ImageUpload } from "@/components/ImageUpload";
import { removeLetterImageAction, updateLetterDefaultsAction, uploadLetterImageAction } from "./actions";

type Props = {
  branchId: string;
  signatoryName: string;
  signatoryTitle: string;
  signatureUrl: string | null;
  stampUrl: string | null;
  letterheadUrl: string | null;
};

export function LettersSection(p: Props) {
  const [state, action, pending] = useActionState(updateLetterDefaultsAction, { error: null } as { error: string | null; ok?: boolean });
  const extra = (kind: string) => ({ branchId: p.branchId, kind });
  return (
    <div className="space-y-6">
      <form action={action} className="space-y-3">
        <input type="hidden" name="branchId" value={p.branchId} />
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-muted">Signatory name</span>
            <input name="signatoryName" defaultValue={p.signatoryName} placeholder="e.g. Ahmed Al Mansoori" className="input w-full" />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-muted">Signatory title</span>
            <input name="signatoryTitle" defaultValue={p.signatoryTitle} placeholder="e.g. General Manager" className="input w-full" />
          </label>
        </div>
        <div className="flex items-center gap-3">
          <button type="submit" className="btn btn-primary" disabled={pending}>{pending ? "Saving…" : "Save signatory"}</button>
          {state.error && <p role="alert" className="text-sm text-[var(--danger-text,#b42318)]">{state.error}</p>}
          {state.ok && <p role="status" className="text-sm text-[var(--success-text,#067647)]">Saved.</p>}
        </div>
      </form>

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
        hint="A full A4 image of your letterhead (header and footer). Used as the page background when a letter is printed on letterhead. Skip this if you print on pre-printed paper."
        shape="square"
        format="image/jpeg"
        maxPx={1600}
        uploadAction={uploadLetterImageAction}
        removeAction={removeLetterImageAction}
        extraFields={extra("letterhead")}
      />
    </div>
  );
}
