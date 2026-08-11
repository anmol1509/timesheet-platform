"use client";

import { useRef } from "react";
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

  return (
    <div className="space-y-4">
      <form
        ref={formRef}
        action={async (formData) => {
          await uploadAttachmentAction(formData);
          formRef.current?.reset();
        }}
        className="flex flex-wrap items-end gap-3 rounded-2xl border border-dashed border-slate-300 p-4"
      >
        <input type="hidden" name="entityType" value={entityType} />
        <input type="hidden" name="entityId" value={entityId} />
        <input type="hidden" name="entityBranchId" value={entityBranchId ?? ""} />
        <input type="hidden" name="revalidate" value={revalidate} />

        <label className="block">
          <span className="mb-1 block text-xs font-medium text-slate-500">Type</span>
          <select
            name="docType"
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[var(--brand-primary)]"
          >
            {docTypeOptions.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-slate-500">Expiry (optional)</span>
          <input
            type="date"
            name="expiryDate"
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[var(--brand-primary)]"
          />
        </label>
        <label className="block flex-1 min-w-[180px]">
          <span className="mb-1 block text-xs font-medium text-slate-500">
            File (max {MAX_UPLOAD_LABEL})
          </span>
          <input
            name="file"
            type="file"
            required
            className="block w-full text-sm text-slate-500 file:mr-3 file:cursor-pointer file:rounded-lg file:border file:border-slate-300 file:bg-white file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-slate-700 file:transition hover:file:bg-slate-50"
          />
        </label>
        <button
          type="submit"
          className="rounded-lg bg-[var(--brand-primary)] px-4 py-2 text-sm font-medium text-white transition hover:bg-[var(--brand-primary-hover)]"
        >
          Upload
        </button>
      </form>

      {attachments.length > 0 && (
        <ul className="divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-200 bg-white">
          {attachments.map((a) => (
            <li key={a.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
              <a
                href={`/api/attachments/${a.id}`}
                target="_blank"
                rel="noreferrer"
                className="min-w-0 flex-1 truncate font-medium text-slate-900 hover:underline"
              >
                {a.filename}
              </a>
              <span className="shrink-0 text-xs text-slate-500">{a.docType}</span>
              {a.expiryDate && (
                <span className="shrink-0 text-xs text-slate-400">
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
