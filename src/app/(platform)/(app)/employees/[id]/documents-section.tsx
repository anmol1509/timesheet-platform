"use client";

import { useRef, useState, useTransition } from "react";
import { Badge } from "@/components/Badge";
import { complianceStatus } from "@/lib/compliance";
import { uploadDocumentAction, deleteDocumentAction } from "./actions";
import { MAX_UPLOAD_BYTES, MAX_UPLOAD_LABEL } from "@/lib/constants";
import { shrinkImage } from "@/lib/compressImage";
import { DeleteButton } from "@/components/DeleteButton";
import { DatePicker } from "@/components/ui/DatePicker";
import { Paperclip, X } from "lucide-react";

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
type Pending = { key: number; file: File; name: string; expiry: string; state: "ready" | "uploading" | "failed"; error?: string };

export function DocumentsSection({
  employeeId,
  documents,
}: {
  employeeId: string;
  documents: Doc[];
}) {
  const [busy, startTransition] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);
  const [rows, setRows] = useState<Pending[]>([]);
  const [notice, setNotice] = useState<string | null>(null);
  const nextKey = useRef(1);

  const otherDocs = documents.filter((d) => d.type === "OTHER");
  const patch = (key: number, change: Partial<Pending>) => setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...change } : r)));

  async function onPick(files: FileList | null) {
    if (!files || files.length === 0) return;
    const added: Pending[] = [];
    const skipped: string[] = [];
    for (const picked of Array.from(files)) {
      // A phone photo is scaled down first; a PDF is left as it is.
      const file = await shrinkImage(picked);
      if (file.size > MAX_UPLOAD_BYTES) { skipped.push(`"${picked.name}" is too large (max ${MAX_UPLOAD_LABEL})`); continue; }
      added.push({ key: nextKey.current++, file, name: picked.name.replace(/\.[A-Za-z0-9]{1,5}$/, ""), expiry: "", state: "ready" });
    }
    setNotice(skipped.length ? `${skipped.join("; ")}. Not added.` : null);
    setRows((rs) => [...rs, ...added]);
    if (fileRef.current) fileRef.current.value = "";
  }

  // One request per file, so a single big or failing file never takes the others with it.
  function uploadAll() {
    const todo = rows.filter((r) => r.state !== "uploading");
    if (todo.length === 0) return;
    setNotice(null);
    startTransition(async () => {
      for (const r of todo) {
        patch(r.key, { state: "uploading", error: undefined });
        const fd = new FormData();
        fd.append("employeeId", employeeId);
        fd.append("type", "OTHER");
        fd.append("name", r.name.trim());
        fd.append("expiryDate", r.expiry);
        fd.append("file", r.file);
        try {
          const res = await uploadDocumentAction(fd);
          if (res?.error) patch(r.key, { state: "failed", error: res.error });
          else setRows((rs) => rs.filter((x) => x.key !== r.key));
        } catch {
          patch(r.key, { state: "failed", error: "Couldn't upload this file. Try again." });
        }
      }
    });
  }

  return (
    <section>
      <h2 className="mb-3 text-sm font-semibold text-primary">Other Documents</h2>
      <div className="card">
        <div className="space-y-3 border-b border-default p-4">
          <div className="flex flex-wrap items-center gap-3">
            <input ref={fileRef} id={`other-docs-${employeeId}`} type="file" multiple onChange={(e) => onPick(e.target.files)} className="sr-only" />
            <label htmlFor={`other-docs-${employeeId}`} className="btn btn-secondary inline-flex cursor-pointer items-center gap-1.5">
              <Paperclip className="h-4 w-4" aria-hidden />
              {rows.length === 0 ? "Attach files" : "Add more files"}
            </label>
            <span className="text-xs text-muted">PDF or image, up to {MAX_UPLOAD_LABEL} each. Pick several at once, or add more later.</span>
          </div>

          {rows.length > 0 && (
            <ul className="space-y-2">
              {rows.map((r) => (
                <li key={r.key} className="grid grid-cols-1 items-end gap-3 rounded-md border border-default p-3 sm:grid-cols-[minmax(0,1fr)_14rem_auto]">
                  <label className="block min-w-0">
                    <span className="mb-1 block text-xs font-medium text-muted">Name <span className="font-normal">({r.file.name})</span></span>
                    <input value={r.name} onChange={(e) => patch(r.key, { name: e.target.value })} disabled={r.state === "uploading"} placeholder="e.g. Contract, Offer letter" className="input w-full" />
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-xs font-medium text-muted">Expiry date (optional)</span>
                    <DatePicker value={r.expiry} onChange={(v) => patch(r.key, { expiry: v })} disabled={r.state === "uploading"} className="w-full" />
                  </label>
                  <button type="button" disabled={r.state === "uploading"} onClick={() => setRows((rs) => rs.filter((x) => x.key !== r.key))} aria-label={`Remove ${r.file.name}`} className="btn btn-secondary h-9 px-2.5"><X className="h-4 w-4" aria-hidden /></button>
                  {r.state === "uploading" && <p className="text-xs text-muted sm:col-span-3">Uploading…</p>}
                  {r.state === "failed" && <p role="alert" className="text-xs text-[var(--error)] sm:col-span-3">{r.error}</p>}
                </li>
              ))}
            </ul>
          )}

          {rows.length > 0 && (
            <div className="flex items-center gap-3">
              <button type="button" className="btn btn-primary" onClick={uploadAll} disabled={busy || rows.every((r) => r.state === "uploading")}>
                {busy ? "Uploading…" : `Upload ${rows.length} document${rows.length === 1 ? "" : "s"}`}
              </button>
              <button type="button" className="text-sm text-muted hover:text-primary" disabled={busy} onClick={() => setRows([])}>Clear</button>
            </div>
          )}
        </div>
        {notice && (
          <p className="border-b border-[var(--error-border)] bg-[var(--error-soft)] px-4 py-2 text-xs text-[var(--error)]">
            {notice}
          </p>
        )}

        {otherDocs.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-muted">
            No other documents uploaded yet.
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-surface-subtle text-left text-xs font-medium tracking-wide text-muted uppercase">
              <tr>
                <th className="px-4 py-3">Document</th>
                <th className="px-4 py-3">Expires</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {otherDocs.map((d) => {
                const status = complianceStatus(d.expiryDate);
                const badge = STATUS_BADGE[status];
                return (
                  <tr key={d.id}>
                    <td className="px-4 py-3 text-primary">
                      <a href={`/api/documents/${d.id}`} className="hover:underline">
                        {d.filename}
                      </a>
                    </td>
                    <td className="px-4 py-3 text-secondary">{d.expiryDate ? new Date(d.expiryDate).toLocaleDateString("en-GB") : "—"}</td>
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
