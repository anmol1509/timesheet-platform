"use client";

import { useRef, useState, useTransition } from "react";
import { Badge } from "@/components/Badge";
import { complianceStatus } from "@/lib/compliance";
import { uploadDocumentAction, deleteDocumentAction, applyExtractedFieldsAction } from "./actions";
import { MAX_UPLOAD_BYTES, MAX_UPLOAD_LABEL } from "@/lib/constants";
import type { ExtractedDocumentFields } from "@/app/api/documents/extract/route";
import { Select } from "@/components/ui/Select";
import { DeleteButton } from "@/components/DeleteButton";

type Doc = {
  id: string;
  type: string;
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

const DOC_TYPES = ["PASSPORT", "VISA", "LABOR_CARD", "MEDICAL", "EMIRATES_ID", "OTHER"];

// Types whose expiry already lives on the employee's Compliance section — don't ask again.
const COMPLIANCE_LINKED: Record<string, string> = {
  PASSPORT: "Passport expiry",
  VISA: "Visa expiry",
  LABOR_CARD: "Labor card expiry",
  MEDICAL: "Medical certificate expiry",
  EMIRATES_ID: "Emirates ID expiry",
};

function toDateInput(d: Date | null) {
  if (!d) return "";
  return new Date(d).toISOString().slice(0, 10);
}

export function DocumentsSection({
  employeeId,
  documents,
  complianceDates,
}: {
  employeeId: string;
  documents: Doc[];
  complianceDates: Record<string, Date | null>;
}) {
  const [pending, startTransition] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);
  const [type, setType] = useState("PASSPORT");
  const [expiryDate, setExpiryDate] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [extracting, setExtracting] = useState(false);
  const [extracted, setExtracted] = useState<ExtractedDocumentFields | null>(null);
  const [applied, setApplied] = useState(false);

  const linkedLabel = COMPLIANCE_LINKED[type];

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

    const effectiveExpiry = linkedLabel ? toDateInput(complianceDates[type]) : expiryDate;

    const formData = new FormData();
    formData.append("employeeId", employeeId);
    formData.append("type", type);
    formData.append("expiryDate", effectiveExpiry);
    formData.append("file", file);
    startTransition(() => {
      uploadDocumentAction(formData);
    });

    if (type !== "OTHER" && (file.type.startsWith("image/") || file.type === "application/pdf")) {
      setExtracting(true);
      try {
        const extractForm = new FormData();
        extractForm.append("file", file);
        const res = await fetch("/api/documents/extract", { method: "POST", body: extractForm });
        if (res.ok) {
          const data = (await res.json()) as ExtractedDocumentFields;
          setExtracted(data);
        }
      } catch {
        // Extraction is a convenience — silently skip on failure.
      } finally {
        setExtracting(false);
      }
    }

    if (fileRef.current) fileRef.current.value = "";
    setExpiryDate("");
  }

  return (
    <section>
      <h2 className="mb-3 text-sm font-semibold text-slate-900">Documents</h2>
      <div className="rounded-3xl border border-slate-200 bg-white">
        <div className="flex flex-wrap items-end gap-3 border-b border-slate-100 p-4">
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-slate-500">
              Type
            </span>
            <Select
              value={type}
              onChange={setType}
              searchable={false}
              triggerClassName="min-w-[180px]"
              options={DOC_TYPES.map((t) => ({ value: t, label: t.replace("_", " ") }))}
            />
          </label>
          {linkedLabel ? (
            <p className="max-w-[220px] text-xs text-slate-400">
              Expiry comes from &ldquo;{linkedLabel}&rdquo; below — no need to enter it again.
            </p>
          ) : (
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-slate-500">
                Expiry date (optional)
              </span>
              <input
                type="date"
                value={expiryDate}
                onChange={(e) => setExpiryDate(e.target.value)}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900"
              />
            </label>
          )}
          <input
            ref={fileRef}
            type="file"
            onChange={handleUpload}
            disabled={pending}
            className="text-sm"
          />
        </div>
        {error && (
          <p className="border-b border-red-100 bg-red-50 px-4 py-2 text-xs text-red-700">
            {error}
          </p>
        )}
        {extracting && (
          <p className="border-b border-slate-100 bg-slate-50 px-4 py-2 text-xs text-slate-500">
            Reading document details…
          </p>
        )}
        {extracted && !applied && (
          <div className="border-b border-blue-100 bg-blue-50 px-4 py-3">
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
              <form
                action={async (formData) => {
                  await applyExtractedFieldsAction(formData);
                  setApplied(true);
                }}
              >
                <input type="hidden" name="employeeId" value={employeeId} />
                <input type="hidden" name="name" value={extracted.name ?? ""} />
                <input type="hidden" name="passportNumber" value={extracted.passportNumber ?? ""} />
                <input type="hidden" name="emiratesId" value={extracted.emiratesId ?? ""} />
                <input type="hidden" name="dateOfBirth" value={extracted.dateOfBirth ?? ""} />
                <input type="hidden" name="nationality" value={extracted.nationality ?? ""} />
                <button
                  type="submit"
                  className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700"
                >
                  Apply to profile
                </button>
              </form>
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
        {applied && (
          <p className="border-b border-emerald-100 bg-emerald-50 px-4 py-2 text-xs text-emerald-700">
            Applied to profile.
          </p>
        )}

        {documents.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-slate-500">
            No documents uploaded yet.
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs font-medium tracking-wide text-slate-500 uppercase">
              <tr>
                <th className="px-4 py-3">Document</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Expiry</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {documents.map((d) => {
                const status = complianceStatus(d.expiryDate);
                const badge = STATUS_BADGE[status];
                return (
                  <tr key={d.id}>
                    <td className="px-4 py-3 text-slate-900">
                      <a
                        href={`/api/documents/${d.id}`}
                        className="hover:underline"
                      >
                        {d.filename}
                      </a>
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {d.type.replace("_", " ")}
                    </td>
                    <td className="px-4 py-3">
                      <Badge color={badge.color}>{badge.label}</Badge>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <DeleteButton
                        action={deleteDocumentAction}
                        hiddenFields={{ documentId: d.id, employeeId }}
                        confirmMessage={`Remove "${d.filename}" from this employee's documents?`}
                        label="Remove"
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </section>
  );
}
