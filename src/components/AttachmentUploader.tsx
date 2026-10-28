"use client";

import { useRef, useState } from "react";
import { OtherDocFields } from "@/components/OtherDocFields";
import { readOtherDoc } from "@/components/otherDocRead";
import { readCompanyDoc } from "@/components/companyDocRead";
import { nameFromFile, otherDocProblem, trackedExpiry } from "@/lib/otherDoc";
import { uploadAttachmentAction, deleteAttachmentAction } from "@/lib/attachments";
import { MAX_UPLOAD_LABEL } from "@/lib/constants";
import { DeleteButton } from "@/components/DeleteButton";
import { Select } from "@/components/ui/Select";
import { DatePicker } from "@/components/ui/DatePicker";

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
  readOnly = false,
}: {
  entityType: string;
  entityId: string;
  entityBranchId: string | null;
  revalidate: string;
  docTypeOptions: { value: string; label: string }[];
  attachments: AttachmentRow[];
  /** Only list the files: no upload form and no delete (a person who may only look). */
  readOnly?: boolean;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [error, setError] = useState<string | null>(null);
  // Type "Other" is the catch-all: it asks for a name, whether to track expiry and the date, read from the file when it can.
  const [type, setType] = useState(docTypeOptions[0]?.value ?? "");
  const isOther = type === "OTHER";
  const [name, setName] = useState("");
  const [track, setTrack] = useState(false);
  const [expiry, setExpiry] = useState("");
  // A company document's expiry is read from the file when it is chosen, for the person to check.
  const [plainExpiry, setPlainExpiry] = useState("");
  const [readNumber, setReadNumber] = useState("");
  const [readIssue, setReadIssue] = useState("");
  const [note, setNote] = useState<string | null>(null);
  const resetOther = () => { setName(""); setTrack(false); setExpiry(""); setPlainExpiry(""); setReadNumber(""); setReadIssue(""); setNote(null); };

  async function onFile(file: File | undefined) {
    if (!file) return;
    if (!isOther) {
      if (entityType !== "SUPPLIER") return;
      setNote("Reading the file for its expiry date…");
      const read = await readCompanyDoc(file);
      if (read) { setReadNumber(read.number); setReadIssue(read.issue); }
      if (read?.expiry) { setPlainExpiry(read.expiry); setNote("Expiry read from the file. Check it before uploading."); }
      else setNote(null);
      return;
    }
    const guess = nameFromFile(file.name);
    setName((n) => n || guess);
    setNote("Reading the file…");
    const read = await readOtherDoc(file);
    if (!read) { setNote(null); return; }
    setName((n) => (n === guess && read.name ? read.name : n));
    if (read.expiry) { setTrack(true); setExpiry((e) => e || read.expiry); }
    setNote(read.name || read.expiry ? "Filled in from the file. Check it before uploading." : null);
  }

  return (
    <div className="space-y-4">
      {!readOnly && <form
        ref={formRef}
        action={async (formData) => {
          setError(null);
          if (isOther) {
            const why = otherDocProblem(name, track, expiry);
            if (why) { setError(why); return; }
            formData.set("name", name.trim());
            formData.set("expiryDate", trackedExpiry(track, expiry));
          }
          const result = await uploadAttachmentAction(formData);
          if (result?.error) {
            setError(result.error);
            return;
          }
          formRef.current?.reset();
          resetOther();
        }}
        className="flex flex-wrap items-end gap-3 rounded-2xl border border-dashed border-strong p-4"
      >
        <input type="hidden" name="entityType" value={entityType} />
        <input type="hidden" name="entityId" value={entityId} />
        <input type="hidden" name="entityBranchId" value={entityBranchId ?? ""} />
        <input type="hidden" name="revalidate" value={revalidate} />
        <input type="hidden" name="docNumber" value={readNumber} />
        <input type="hidden" name="issueDate" value={readIssue} />

        <label className="block">
          <span className="mb-1 block text-xs font-medium text-muted">Type</span>
<Select name="docType" value={type} onChange={(v) => { setType(v); if (v !== "OTHER") resetOther(); }} options={docTypeOptions.map((o) => ({ value: o.value, label: o.label }))} />
        </label>
        {!isOther && (
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-muted">Expiry (optional)</span>
            <DatePicker name="expiryDate" value={plainExpiry} onChange={setPlainExpiry} />
          </label>
        )}
        <label className="block flex-1 min-w-[180px]">
          <span className="mb-1 block text-xs font-medium text-muted">
            File (max {MAX_UPLOAD_LABEL})
          </span>
          <input
            name="file"
            type="file"
            required
            className="file-input"
            onChange={(e) => void onFile(e.target.files?.[0])}
          />
        </label>
        {isOther && <OtherDocFields name={name} onName={setName} track={track} onTrack={setTrack} expiry={expiry} onExpiry={setExpiry} note={note} className="grid w-full grid-cols-1 items-end gap-3 sm:grid-cols-[minmax(0,1fr)_auto_14rem]" />}
        <button
          type="submit"
          className="btn btn-primary"
        >
          Upload
        </button>
        {!isOther && note && <p className="w-full text-xs text-muted">{note}</p>}
      </form>}

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
                  expires {new Date(a.expiryDate).toLocaleDateString("en-GB")}
                </span>
              )}
              {!readOnly && <DeleteButton
                action={deleteAttachmentAction}
                hiddenFields={{ attachmentId: a.id, revalidate }}
                confirmMessage={`Delete "${a.filename}"?`}
              />}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
