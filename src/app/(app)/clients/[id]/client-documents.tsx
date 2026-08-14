"use client";

import { useRef, useState, useTransition } from "react";
import { Badge } from "@/components/Badge";
import { complianceStatus } from "@/lib/compliance";
import { addClientDocumentAction, deleteClientDocumentAction } from "../actions";
import { MAX_UPLOAD_BYTES, MAX_UPLOAD_LABEL } from "@/lib/constants";
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

const DOC_TYPES = ["TRADE_LICENSE", "TRN_CERTIFICATE", "CONTRACT", "OTHER"];

export function ClientDocuments({
  clientId,
  documents,
}: {
  clientId: string;
  documents: Doc[];
}) {
  const [pending, startTransition] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);
  const [type, setType] = useState("TRADE_LICENSE");
  const [expiryDate, setExpiryDate] = useState("");
  const [error, setError] = useState<string | null>(null);

  function handleUpload() {
    const file = fileRef.current?.files?.[0];
    if (!file) return;
    if (file.size > MAX_UPLOAD_BYTES) {
      setError(`"${file.name}" is too large — max ${MAX_UPLOAD_LABEL}.`);
      if (fileRef.current) fileRef.current.value = "";
      return;
    }
    setError(null);
    const formData = new FormData();
    formData.append("clientId", clientId);
    formData.append("type", type);
    formData.append("expiryDate", expiryDate);
    formData.append("file", file);
    startTransition(() => {
      addClientDocumentAction(formData);
    });
    if (fileRef.current) fileRef.current.value = "";
    setExpiryDate("");
  }

  return (
    <section>
      <h2 className="mb-3 text-sm font-semibold text-primary">Documents</h2>
      <div className="card">
        <div className="flex flex-wrap items-end gap-3 border-b border-default p-4">
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-muted">
              Type
            </span>
            <Select
              value={type}
              onChange={setType}
              searchable={false}
              triggerClassName="min-w-[180px]"
              options={DOC_TYPES.map((t) => ({ value: t, label: t.replace(/_/g, " ") }))}
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-muted">
              Expiry date (optional)
            </span>
            <input
              type="date"
              value={expiryDate}
              onChange={(e) => setExpiryDate(e.target.value)}
              className="input"
            />
          </label>
          <input
            ref={fileRef}
            type="file"
            onChange={handleUpload}
            disabled={pending}
            className="file-input"
          />
        </div>
        {error && (
          <p className="border-b border-red-100 bg-red-50 px-4 py-2 text-xs text-red-700">
            {error}
          </p>
        )}

        {documents.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-muted">
            No documents uploaded yet.
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-surface-subtle text-left text-xs font-medium tracking-wide text-muted uppercase">
              <tr>
                <th className="px-4 py-3">Document</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Expiry</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {documents.map((d) => {
                const status = complianceStatus(d.expiryDate);
                const badge = STATUS_BADGE[status];
                return (
                  <tr key={d.id}>
                    <td className="px-4 py-3 text-primary">
                      <a
                        href={`/api/client-documents/${d.id}`}
                        className="hover:underline"
                      >
                        {d.filename}
                      </a>
                    </td>
                    <td className="px-4 py-3 text-secondary">
                      {d.type.replace(/_/g, " ")}
                    </td>
                    <td className="px-4 py-3">
                      <Badge color={badge.color}>{badge.label}</Badge>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <DeleteButton
                        action={deleteClientDocumentAction}
                        hiddenFields={{ documentId: d.id, clientId }}
                        confirmMessage={`Remove "${d.filename}" from this client's documents?`}
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
