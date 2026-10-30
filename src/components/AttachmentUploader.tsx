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
  /** `hasExpiry` marks a type whose files need an expiry date (or an explicit "no expiry"), so nothing goes untracked by accident. */
  docTypeOptions: { value: string; label: string; hasExpiry?: boolean }[];
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
  // Where the date came from: a file is being read, a date was read from it, or nothing could be read.
  const [readState, setReadState] = useState<"idle" | "reading" | "read" | "failed">("idle");
  const [hasFile, setHasFile] = useState(false);
  const [noExpiry, setNoExpiry] = useState(false);
  const needsExpiry = !isOther && !!docTypeOptions.find((o) => o.value === type)?.hasExpiry;
  // A document that carries an expiry must have a date (or be marked as having none) before it can be filed, or it is never tracked.
  const blocked = needsExpiry && hasFile && (readState === "reading" || (!plainExpiry && !noExpiry));
  const resetOther = () => { setName(""); setTrack(false); setExpiry(""); setPlainExpiry(""); setReadNumber(""); setReadIssue(""); setNote(null); setReadState("idle"); setHasFile(false); setNoExpiry(false); };

  async function onFile(file: File | undefined) {
    setHasFile(!!file);
    setNoExpiry(false);
    setPlainExpiry("");
    setReadState("idle");
    if (!file) return;
    if (!isOther) {
      setNote("Reading the file for its expiry date…");
      setReadState("reading");
      // A supplier's papers have their own reader (licences, permits, TRN); every other record's files use the general one.
      const read = entityType === "SUPPLIER"
        ? await readCompanyDoc(file)
        : await readOtherDoc(file).then((r) => (r ? { expiry: r.expiry, number: r.docNumber, issue: r.issueDate } : null));
      if (read) { setReadNumber(read.number); setReadIssue(read.issue); }
      if (read?.expiry) { setPlainExpiry(read.expiry); setNote("Expiry read from the file. Check it before uploading."); setReadState("read"); }
      else { setNote(null); setReadState("failed"); }
      return;
    }
    const guess = nameFromFile(file.name);
    setName((n) => n || guess);
    setNote("Reading the file…");
    const read = await readOtherDoc(file);
    if (!read) { setNote(null); return; }
    setName((n) => (n === guess && read.name ? read.name : n));
    if (read.expiry) { setTrack(true); setExpiry((e) => e || read.expiry); }
    setReadNumber(read.docNumber); setReadIssue(read.issueDate);
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
        className="flex flex-wrap items-start gap-3 rounded-2xl border border-dashed border-strong p-4"
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
          <div className="w-56">
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-muted">{needsExpiry ? <>Expiry date <span className="text-[var(--error)]">*</span></> : "Expiry (optional)"}</span>
              <DatePicker name="expiryDate" value={plainExpiry} onChange={(v) => { setPlainExpiry(v); if (v) setNoExpiry(false); }} />
            </label>
            {needsExpiry && readState === "read" && plainExpiry && <span className="mt-1 block text-xs text-[var(--success)]">Read from the file. Check it before uploading.</span>}
            {needsExpiry && readState === "reading" && <span className="mt-1 block text-xs text-muted">Reading the file for its date…</span>}
            {needsExpiry && hasFile && readState === "failed" && !plainExpiry && !noExpiry && <span className="mt-1 block text-xs text-[var(--error)]">Couldn&rsquo;t read a date from this file. Enter it so you get a reminder.</span>}
            {needsExpiry && hasFile && readState !== "reading" && (
              <label className="mt-1.5 flex items-center gap-1.5 text-xs text-muted">
                <input type="checkbox" checked={noExpiry} onChange={(e) => { setNoExpiry(e.target.checked); if (e.target.checked) setPlainExpiry(""); }} />
                This document has no expiry
              </label>
            )}
          </div>
        )}
        {needsExpiry && noExpiry && <input type="hidden" name="noExpiry" value="1" />}
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
          disabled={blocked}
          title={blocked ? "Enter the expiry date, or tick that this document has no expiry." : undefined}
          className="btn btn-primary mt-5 disabled:opacity-50"
        >
          Upload
        </button>
        {!isOther && !needsExpiry && note && <p className="w-full text-xs text-muted">{note}</p>}
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
