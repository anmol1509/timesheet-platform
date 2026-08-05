"use client";

import { useRef, useState, useTransition } from "react";
import { Badge } from "@/components/Badge";
import { complianceStatus } from "@/lib/compliance";
import { uploadDocumentAction, deleteDocumentAction, applyExtractedFieldsAction } from "./actions";
import { MAX_UPLOAD_BYTES, MAX_UPLOAD_LABEL } from "@/lib/constants";
import type { ExtractedDocumentFields } from "@/app/api/documents/extract/route";

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
  type,
  documents,
  expiryFieldName,
  enableExtraction = true,
}: {
  employeeId: string;
  type: string;
  documents: Doc[];
  // Name of the sibling <input> in the same <form> holding this document's
  // expiry date — read live at upload time so a date typed moments ago is
  // used even before "Save changes" is clicked.
  expiryFieldName?: string;
  enableExtraction?: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [removingId, setRemovingId] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [extracting, setExtracting] = useState(false);
  const [extracted, setExtracted] = useState<ExtractedDocumentFields | null>(null);
  const [applied, setApplied] = useState(false);

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

  async function handleUpload() {
    const file = fileRef.current?.files?.[0];
    if (!file) return;
    if (file.size > MAX_UPLOAD_BYTES) {
      setError(`"${file.name}" is too large — max ${MAX_UPLOAD_LABEL}.`);
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

    const formData = new FormData();
    formData.append("employeeId", employeeId);
    formData.append("type", type);
    formData.append("expiryDate", expiryDate);
    formData.append("file", file);
    startTransition(() => {
      uploadDocumentAction(formData);
    });

    if (enableExtraction && (file.type.startsWith("image/") || file.type === "application/pdf")) {
      setExtracting(true);
      try {
        const extractForm = new FormData();
        extractForm.append("file", file);
        const res = await fetch("/api/documents/extract", { method: "POST", body: extractForm });
        if (res.ok) setExtracted((await res.json()) as ExtractedDocumentFields);
      } catch {
        // Extraction is a convenience — silently skip on failure.
      } finally {
        setExtracting(false);
      }
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
                  className="min-w-0 flex-1 truncate text-slate-900 hover:underline"
                >
                  {d.filename}
                </a>
                <Badge color={badge.color}>{badge.label}</Badge>
                <button
                  type="button"
                  disabled={removingId === d.id}
                  onClick={() => handleRemove(d.id)}
                  className="text-xs font-medium text-red-600 hover:underline disabled:opacity-60"
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
        className="text-sm text-slate-500"
      />
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
      {extracting && <p className="mt-1 text-xs text-slate-500">Reading document details…</p>}
      {extracted && !applied && (
        <div className="mt-2 rounded-lg border border-blue-100 bg-blue-50 p-3">
          <p className="mb-2 text-xs font-medium text-blue-900">
            Auto-read from the document — apply to this employee&rsquo;s profile?
          </p>
          <div className="mb-2 grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-blue-800 sm:grid-cols-4">
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
              className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700"
            >
              Apply to profile
            </button>
            <button
              type="button"
              onClick={() => setExtracted(null)}
              className="rounded-lg border border-blue-200 px-3 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-100"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}
      {applied && <p className="mt-1 text-xs text-emerald-600">Applied to profile.</p>}
    </div>
  );
}
