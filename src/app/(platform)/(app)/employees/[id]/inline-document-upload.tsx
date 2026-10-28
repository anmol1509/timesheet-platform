"use client";

import { useRef, useState, useTransition } from "react";
import { Badge } from "@/components/Badge";
import { complianceStatus } from "@/lib/compliance";
import { uploadDocumentAction, deleteDocumentAction, applyExtractedFieldsAction } from "./actions";
import { MAX_UPLOAD_BYTES, MAX_UPLOAD_LABEL } from "@/lib/constants";
import { shrinkImage } from "@/lib/compressImage";
import type { ExtractedDocumentFields } from "@/app/api/documents/extract/route";
import { identityMismatch } from "@/lib/personName";

type Doc = {
  id: string;
  filename: string;
  expiryDate: Date | null;
  uploadedAt: Date;
};

const STATUS_BADGE = {
  valid: { label: "Valid", color: "green" as const },
  expiring: { label: "Expiring soon", color: "amber" as const },
  expired: { label: "Expired", color: "red" as const },
  not_set: { label: "No expiry set", color: "slate" as const },
};

// A compact upload/view/remove control for one document type, dropped
// directly into the field section it belongs to (Visa, Passport, CICPA,
// etc.) instead of a separate generic "Documents" area disconnected from
// where the corresponding fields are being filled in.
export function InlineDocumentUpload({
  employeeId,
  employeeName,
  employeeDob,
  type,
  documents,
  expiryFieldName,
  enableExtraction = true,
  onExtracted,
}: {
  employeeId: string;
  // Who this is being filed against. A document that reads as someone else is held back and asked about, not filed.
  employeeName?: string;
  employeeDob?: string | null;
  type: string;
  documents: Doc[];
  // Name of the sibling <input> in the same <form> holding this document's
  // expiry date — read live at upload time so a date typed moments ago is
  // used even before "Save changes" is clicked.
  expiryFieldName?: string;
  enableExtraction?: boolean;
  // When provided, a successful extraction calls this directly instead of
  // showing the read-only preview + "Apply to profile" button — the caller
  // is expected to write the values straight into its own editable inputs
  // (see edit-form.tsx for PASSPORT/EMIRATES_ID/LABOR_CARD).
  onExtracted?: (fields: ExtractedDocumentFields) => void;
}) {
  const [pending, startTransition] = useTransition();
  const [removingId, setRemovingId] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [extracting, setExtracting] = useState(false);
  const [extracted, setExtracted] = useState<ExtractedDocumentFields | null>(null);
  const [applied, setApplied] = useState(false);
  // A document that reads as a different person, waiting for a decision.
  const [held, setHeld] = useState<{ file: File; expiryDate: string; fields: ExtractedDocumentFields; reason: NonNullable<ReturnType<typeof identityMismatch>> } | null>(null);

  // This component is rendered inside the employee edit page's single big
  // <form> (so the sibling-expiry-field lookup below works), which means a
  // nested <form> for the delete button isn't valid HTML — browsers silently
  // drop nested forms. Call the server action directly instead.
  function handleRemove(documentId: string) {
    setRemovingId(documentId);
    const formData = new FormData();
    formData.append("documentId", documentId);
    formData.append("employeeId", employeeId);
    startTransition(async () => {
      await deleteDocumentAction(formData);
      setRemovingId(null);
    });
  }

  function fileDocument(file: File, expiryDate: string, fields: ExtractedDocumentFields | null) {
    // No expiry typed: file the document under the one read from it (the person can correct it on the record afterwards).
    const readExpiry = expiryFieldName ? ((fields as Record<string, unknown> | null)?.[expiryFieldName] as string | undefined) : undefined;
    const filedExpiry = expiryDate || (readExpiry && /^\d{4}-\d{2}-\d{2}$/.test(readExpiry) ? readExpiry : "");
    const formData = new FormData();
    formData.append("employeeId", employeeId);
    formData.append("type", type);
    formData.append("expiryDate", filedExpiry);
    formData.append("file", file);
    startTransition(() => {
      uploadDocumentAction(formData);
    });
    if (!fields) return;
    if (onExtracted) {
      onExtracted(fields);
      setApplied(true);
    } else {
      setExtracted(fields);
    }
  }

  async function handleUpload() {
    const picked = fileRef.current?.files?.[0];
    if (!picked) return;
    // A phone photo is scaled down first; a PDF is left as it is.
    const file = await shrinkImage(picked);
    if (file.size > MAX_UPLOAD_BYTES) {
      setError(`"${file.name}" is too large: max ${MAX_UPLOAD_LABEL}.`);
      if (fileRef.current) fileRef.current.value = "";
      return;
    }
    setError(null);
    setExtracted(null);
    setApplied(false);

    const form = fileRef.current?.closest("form");
    const expiryDate = expiryFieldName
      ? (form?.querySelector<HTMLInputElement>(`input[name="${expiryFieldName}"]`)?.value ?? "")
      : "";

    const wantsExtraction = enableExtraction && (file.type.startsWith("image/") || file.type === "application/pdf");
    let fields: ExtractedDocumentFields | null = null;
    if (wantsExtraction) {
      setExtracting(true);
      try {
        const extractForm = new FormData();
        extractForm.append("file", file);
        extractForm.append("docType", type);
        const res = await fetch("/api/documents/extract", { method: "POST", body: extractForm });
        if (res.ok) fields = (await res.json()) as ExtractedDocumentFields;
      } catch {
        // Extraction is a convenience — silently skip on failure.
      } finally {
        setExtracting(false);
      }
    }

    // Read before filing: a document that is plainly someone else's is not filed or applied until it is confirmed.
    const reason = fields && employeeName ? identityMismatch(fields, { name: employeeName, dateOfBirth: employeeDob }) : null;
    if (fields && reason) {
      setHeld({ file, expiryDate, fields, reason });
    } else {
      fileDocument(file, expiryDate, fields);
    }

    if (fileRef.current) fileRef.current.value = "";
  }

  return (
    <div className="sm:col-span-2">
      {documents.length > 0 && (
        <ul className="mb-2 space-y-1">
          {documents.map((d) => {
            const badge = STATUS_BADGE[complianceStatus(d.expiryDate)];
            return (
              <li key={d.id} className="flex items-center gap-2 text-sm">
                <a
                  href={`/api/documents/${d.id}`}
                  target="_blank"
                  rel="noreferrer"
                  className="min-w-0 flex-1 truncate text-primary hover:underline"
                >
                  {d.filename}
                </a>
                <Badge color={badge.color}>{badge.label}</Badge>
                <button
                  type="button"
                  disabled={removingId === d.id}
                  onClick={() => handleRemove(d.id)}
                  className="text-xs font-medium text-[var(--error)] hover:underline disabled:opacity-60"
                >
                  {removingId === d.id ? "Removing…" : "Remove"}
                </button>
              </li>
            );
          })}
        </ul>
      )}
      <input
        ref={fileRef}
        type="file"
        onChange={handleUpload}
        disabled={pending}
        className="file-input"
      />
      {error && <p className="mt-1 text-xs text-[var(--error)]">{error}</p>}
      {extracting && <p className="mt-1 text-xs text-muted">Reading document details…</p>}
      {held && (
        <div role="alert" className="mt-2 rounded-lg border border-[var(--error-border)] bg-[var(--error-soft)] p-3 text-sm">
          <p className="font-semibold text-[var(--error)]">
            {held.reason.kind === "name" ? "This doesn’t look like this employee’s document." : "The date of birth on this document is different."}
          </p>
          <p className="mt-1 text-xs text-secondary">
            {held.reason.kind === "name"
              ? <>It reads <b className="text-primary">{held.reason.documentName || "a different name"}</b>, but you are on <b className="text-primary">{employeeName}</b>.</>
              : <>The name matches <b className="text-primary">{employeeName}</b>, but the document shows {held.fields.dateOfBirth} and the record has {employeeDob?.slice(0, 10)}. These may be two different people with the same name.</>}{" "}
            Nothing has been uploaded or filled in.
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => setHeld(null)}>Cancel</button>
            <button type="button" className="rounded-lg border border-[var(--error-border)] px-3 py-1.5 text-xs font-medium text-[var(--error)] hover:bg-[var(--error-soft)]" onClick={() => { const h = held; setHeld(null); fileDocument(h.file, h.expiryDate, h.fields); }}>
              It&rsquo;s the right person, upload anyway
            </button>
          </div>
        </div>
      )}
      {extracted && !applied && (
        <div className="mt-2 rounded-lg border border-[var(--info-border)] bg-[var(--info-soft)] p-3">
          <p className="mb-2 text-xs font-medium text-[var(--brand-primary)]">
            Auto-read from the document: apply to this employee&rsquo;s profile?
          </p>
          <div className="mb-2 grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-[var(--brand-primary)] sm:grid-cols-4">
            {extracted.name && <span>Name: {extracted.name}</span>}
            {extracted.passportNumber && <span>Passport: {extracted.passportNumber}</span>}
            {extracted.emiratesId && <span>Emirates ID: {extracted.emiratesId}</span>}
            {extracted.dateOfBirth && <span>DOB: {extracted.dateOfBirth}</span>}
            {extracted.nationality && <span>Nationality: {extracted.nationality}</span>}
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => {
                const formData = new FormData();
                formData.append("employeeId", employeeId);
                formData.append("name", extracted.name ?? "");
                formData.append("passportNumber", extracted.passportNumber ?? "");
                formData.append("emiratesId", extracted.emiratesId ?? "");
                formData.append("dateOfBirth", extracted.dateOfBirth ?? "");
                formData.append("nationality", extracted.nationality ?? "");
                startTransition(async () => {
                  await applyExtractedFieldsAction(formData);
                  setApplied(true);
                });
              }}
              className="btn btn-primary btn-sm"
            >
              Apply to profile
            </button>
            <button
              type="button"
              onClick={() => setExtracted(null)}
              className="rounded-lg border border-[var(--info-border)] px-3 py-1.5 text-xs font-medium text-[var(--brand-primary)] hover:bg-[var(--info-soft)]"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}
      {applied && (
        <p className="mt-1 text-xs text-[var(--success)]">
          {onExtracted
            ? "Auto-filled below: review before saving."
            : "Applied to profile."}
        </p>
      )}
    </div>
  );
}
