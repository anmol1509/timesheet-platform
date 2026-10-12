"use client";

import { useRef, useState } from "react";
import { Paperclip } from "lucide-react";
import { uploadAttachmentAction, deleteAttachmentAction } from "@/lib/attachments";
import { DeleteButton } from "@/components/DeleteButton";
import { MAX_UPLOAD_LABEL } from "@/lib/constants";

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
}: {
  candidateId: string;
  candidateBranchId: string;
  stageKey: string;
  attachments: StageAttachmentRow[];
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  return (
    <div className="border-t border-default px-4 py-3">
      <form
        ref={formRef}
        action={async (fd) => {
          setError(null);
          setUploading(true);
          const result = await uploadAttachmentAction(fd);
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
        <input name="file" type="file" required className="file-input text-xs" />
        <button type="submit" className="btn btn-secondary px-2.5 py-1 text-xs" disabled={uploading}>
          {uploading ? "Attaching…" : "Attach"}
        </button>
        <span className="text-[11px] text-subtle">max {MAX_UPLOAD_LABEL}</span>
      </form>
      {error && <p role="alert" className="mt-1 text-xs text-[var(--error)]">{error}</p>}
      {attachments.length > 0 && (
        <ul className="mt-2 flex flex-wrap gap-1.5">
          {attachments.map((a) => (
            <li key={a.id} className="flex items-center gap-1 rounded-full bg-surface px-2 py-0.5 text-xs">
              <a href={`/api/attachments/${a.id}`} target="_blank" rel="noreferrer" className="max-w-[10rem] truncate text-primary hover:underline">
                {a.filename}
              </a>
              <DeleteButton
                action={deleteAttachmentAction}
                hiddenFields={{ attachmentId: a.id, revalidate: `/onboarding/${candidateId}` }}
                confirmMessage={`Delete "${a.filename}"?`}
                label="×"
                className="text-subtle hover:text-[var(--error)]"
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
