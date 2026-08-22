"use client";

import { useRef, useState } from "react";
import { uploadAttachmentAction, deleteAttachmentAction } from "@/lib/attachments";
import { MAX_UPLOAD_LABEL } from "@/lib/constants";
import { DeleteButton } from "@/components/DeleteButton";

export type AttachmentRow = {
  id: string;
  docType: string;
  filename: string;
  expiryDate: string | null; // ISO date string, already serialized by the caller
  uploadedAt: string;
};

// One shared upload form + list for entity types that use the generic
// Attachment model (Supplier docs today; Payslips/Visa docs in later
// phases) instead of a dedicated *Document model.
export function AttachmentUploader({
  entityType,
  entityId,
  entityBranchId,
  revalidate,
  docTypeOptions,
  attachments,
}: {
  entityType: string;
  entityId: string;
  entityBranchId: string | null;
  revalidate: string;
  docTypeOptions: { value: string; label: string }[];
  attachments: AttachmentRow[];
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="space-y-4">
      <form
        ref={formRef}
        action={async (formData) => {
          setError(null);
          const result = await uploadAttachmentAction(formData);
          if (result?.error) {
            setError(result.error);
            return;
          }
          formRef.current?.reset();
        }}
        className="flex flex-wrap items-end gap-3 rounded-2xl border border-dashed border-strong p-4"
      >
        <input type="hidden" name="entityType" value={entityType} />
        <input type="hidden" name="entityId" value={entityId} />
        <input type="hidden" name="entityBranchId" value={entityBranchId ?? ""} />
        <input type="hidden" name="revalidate" value={revalidate} />

        <label className="block">
          <span className="mb-1 block text-xs font-medium text-muted">Type</span>
          <select
            name="docType"
            className="input"
          >
            {docTypeOptions.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-muted">Expiry (optional)</span>
          <input
            type="date"
            name="expiryDate"
            className="input"
          />
        </label>
        <label className="block flex-1 min-w-[180px]">
          <span className="mb-1 block text-xs font-medium text-muted">
            File (max {MAX_UPLOAD_LABEL})
          </span>
          <input
            name="file"
            type="file"
            required
            className="file-input"
          />
        </label>
        <button
          type="submit"
          className="btn btn-primary"
        >
          Upload
        </button>
      </form>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {attachments.length > 0 && (
        <ul className="divide-y divide-[var(--border)] overflow-hidden rounded-2xl border border-default bg-surface">
          {attachments.map((a) => (
            <li key={a.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
              <a
                href={`/api/attachments/${a.id}`}
                target="_blank"
                rel="noreferrer"
                className="min-w-0 flex-1 truncate font-medium text-primary hover:underline"
              >
                {a.filename}
              </a>
              <span className="shrink-0 text-xs text-muted">{a.docType}</span>
              {a.expiryDate && (
                <span className="shrink-0 text-xs text-subtle">
                  expires {new Date(a.expiryDate).toLocaleDateString()}
                </span>
              )}
              <DeleteButton
                action={deleteAttachmentAction}
                hiddenFields={{ attachmentId: a.id, revalidate }}
                confirmMessage={`Delete "${a.filename}"?`}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
