"use client";

import { useRef, useState, useTransition } from "react";
import { Badge } from "@/components/Badge";
import { complianceStatus } from "@/lib/compliance";
import { uploadDocumentAction, deleteDocumentAction } from "./actions";
import { MAX_UPLOAD_BYTES, MAX_UPLOAD_LABEL } from "@/lib/constants";
import { DeleteButton } from "@/components/DeleteButton";

type Doc = {
  id: string;
  type: string;
  status: string;
  displayInEss: boolean;
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

// Catch-all for anything that doesn't have a dedicated section above
// (Visa/Passport/Labour Card/Medical/Emirates ID/CICPA/Insurance/Driving
// Licence each carry their own upload next to their fields now). Every
// upload here is tagged OTHER — matching the competitor's own "Other
// Documents" table, which is exactly this: a catch-all, not a master list.
export function DocumentsSection({
  employeeId,
  documents,
}: {
  employeeId: string;
  documents: Doc[];
}) {
  const [pending, startTransition] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);
  const [expiryDate, setExpiryDate] = useState("");
  const [displayInEss, setDisplayInEss] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const otherDocs = documents.filter((d) => d.type === "OTHER");

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
    formData.append("employeeId", employeeId);
    formData.append("type", "OTHER");
    formData.append("expiryDate", expiryDate);
    if (displayInEss) formData.append("displayInEss", "on");
    formData.append("file", file);
    startTransition(() => {
      uploadDocumentAction(formData);
    });

    if (fileRef.current) fileRef.current.value = "";
    setExpiryDate("");
    setDisplayInEss(false);
  }

  return (
    <section>
      <h2 className="mb-3 text-sm font-semibold text-slate-900">Other Documents</h2>
      <div className="rounded-3xl border border-slate-200 bg-white">
        <div className="flex flex-wrap items-end gap-3 border-b border-slate-100 p-4">
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
          <label className="flex items-center gap-1.5 pb-2 text-xs font-medium text-slate-500">
            <input
              type="checkbox"
              checked={displayInEss}
              onChange={(e) => setDisplayInEss(e.target.checked)}
              className="h-4 w-4 rounded border-slate-300"
            />
            Display in ESS
          </label>
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

        {otherDocs.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-slate-500">
            No other documents uploaded yet.
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs font-medium tracking-wide text-slate-500 uppercase">
              <tr>
                <th className="px-4 py-3">Document</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {otherDocs.map((d) => {
                const status = complianceStatus(d.expiryDate);
                const badge = STATUS_BADGE[status];
                return (
                  <tr key={d.id}>
                    <td className="px-4 py-3 text-slate-900">
                      <a href={`/api/documents/${d.id}`} className="hover:underline">
                        {d.filename}
                      </a>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1.5">
                        <Badge color={badge.color}>{badge.label}</Badge>
                        {d.displayInEss && <Badge color="blue">ESS</Badge>}
                      </div>
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
