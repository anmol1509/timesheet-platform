"use client";

import { useRef, useState } from "react";
import { Paperclip } from "lucide-react";
import { deleteAttachmentAction } from "@/lib/attachments";
import { uploadAttachment } from "@/lib/uploadAttachment";
import { DeleteButton } from "@/components/DeleteButton";
import { MAX_UPLOAD_LABEL } from "@/lib/constants";
import { readOtherDoc } from "@/components/otherDocRead";

import { Button } from "@/components/ui/Button";
export type StageAttachmentRow = { id: string; filename: string };

/** A compact per-stage file attach — the same generic Attachment model the
 * page-level "Documents" section uses (entityType "CANDIDATE_ONBOARDING",
 * docType = the stage key), just scoped and shown inline on the stage
 * itself rather than requiring a trip to the shared Documents list. */
export function StageAttachments({
  candidateId,
  candidateBranchId,
  stageKey,
  attachments,
  canEdit = true,
  onRead,
}: {
  candidateId: string;
  candidateBranchId: string;
  stageKey: string;
  attachments: StageAttachmentRow[];
  canEdit?: boolean;
  /** Called with what the AI read from the chosen file (number and expiry), so the step's form can be filled in for checking. */
  onRead?: (read: { docNumber: string; expiry: string }) => void;
}) {
  const [reading, setReading] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  return (
    <div className="border-t border-default px-4 py-3">
      {canEdit && <form
        ref={formRef}
        action={async (fd) => {
          setError(null);
          setUploading(true);
          const result = await uploadAttachment(fd);
          setUploading(false);
          if (result?.error) setError(result.error);
          else formRef.current?.reset();
        }}
        className="flex flex-wrap items-center gap-2"
      >
        <input type="hidden" name="entityType" value="CANDIDATE_ONBOARDING" />
        <input type="hidden" name="entityId" value={candidateId} />
        <input type="hidden" name="entityBranchId" value={candidateBranchId} />
        <input type="hidden" name="docType" value={stageKey} />
        <input type="hidden" name="revalidate" value={`/onboarding/${candidateId}`} />
        <Paperclip className="h-3.5 w-3.5 shrink-0 text-subtle" aria-hidden />
        <input
          name="file"
          type="file"
          required
          className="file-input text-xs"
          onChange={async (e) => {
            const f = e.target.files?.[0];
            if (!f || !onRead) return;
            setReading(true);
            const read = await readOtherDoc(f);
            setReading(false);
            if (read && (read.docNumber || read.expiry)) onRead({ docNumber: read.docNumber, expiry: read.expiry });
          }}
        />
        <Button variant="secondary" size="btn" className="px-2.5 py-1 text-xs" type="submit" disabled={uploading} loading={uploading}>
          Attach
        </Button>
        <span className="text-[11px] text-subtle">{reading ? "Reading the file…" : `max ${MAX_UPLOAD_LABEL}`}</span>
      </form>}
      {error && <p role="alert" className="mt-1 text-xs text-[var(--error)]">{error}</p>}
      {attachments.length > 0 && (
        <ul className="mt-2 flex flex-wrap gap-1.5">
          {attachments.map((a) => (
            <li key={a.id} className="flex items-center gap-1 rounded-full bg-surface px-2 py-0.5 text-xs">
              <a href={`/api/attachments/${a.id}`} target="_blank" rel="noreferrer" className="max-w-[10rem] truncate text-primary hover:underline">
                {a.filename}
              </a>
              {canEdit && <DeleteButton
                action={deleteAttachmentAction}
                hiddenFields={{ attachmentId: a.id, revalidate: `/onboarding/${candidateId}` }}
                confirmMessage={`Delete "${a.filename}"?`}
                label="×"
                className="text-subtle hover:text-[var(--error)]"
              />}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
