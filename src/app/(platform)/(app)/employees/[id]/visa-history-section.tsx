"use client";

import { useRef, useState, useTransition } from "react";
import { Select } from "@/components/ui/Select";
import { addVisaApplicationAction, removeVisaApplicationAction } from "./actions";
import { readOtherDoc } from "@/components/otherDocRead";
import { DatePicker } from "@/components/ui/DatePicker";
import { shrinkImage } from "@/lib/compressImage";
import { Paperclip, X } from "lucide-react";
import { Alert } from "@/components/Alert";

type HistoryRow = {
  id: string;
  stage: string;
  date: Date | null;
  notes: string | null;
  documentId: string | null;
};

type Doc = { id: string; filename: string };

function formatDate(d: Date | null) {
  return d ? new Date(d).toLocaleDateString() : "—";
}

export function VisaHistorySection({
  employeeId,
  entries,
  stages,
  documents,
}: {
  employeeId: string;
  entries: HistoryRow[];
  stages: { value: string }[];
  documents: Doc[];
}) {
  const [pending, startTransition] = useTransition();
  const [formKey, setFormKey] = useState(0);
  const stageRef = useRef<string>("");
  const dateRef = useRef<HTMLInputElement>(null);
  const notesRef = useRef<HTMLTextAreaElement>(null);
  const documentRef = useRef<string>("");
  const [resetKey, setResetKey] = useState(0);
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  function handleAdd() {
    const stage = stageRef.current;
    if (!stage) return;
    const formData = new FormData();
    formData.append("employeeId", employeeId);
    formData.append("stage", stage);
    if (dateRef.current?.value) formData.append("date", dateRef.current.value);
    if (notesRef.current?.value) formData.append("notes", notesRef.current.value);
    if (file) formData.append("file", file);
    else if (documentRef.current) formData.append("documentId", documentRef.current);
    setError(null);
    startTransition(async () => {
      const r = await addVisaApplicationAction(formData);
      if (r?.error) setError(r.error);
    });
    stageRef.current = "";
    documentRef.current = "";
    setResetKey((k) => k + 1);
    if (dateRef.current) dateRef.current.value = "";
    if (notesRef.current) notesRef.current.value = "";
    setFormKey((k) => k + 1);
    setFile(null);
    if (fileRef.current) fileRef.current.value = "";
  }

  async function onPick(picked: File | null) {
    setError(null);
    const f = picked ? await shrinkImage(picked) : null;
    setFile(f);
    // Read the number and expiry off the file into the notes for the person to check; nothing is saved until they press Add.
    if (f && notesRef.current && !notesRef.current.value) {
      const read = await readOtherDoc(f);
      const parts = [read?.docNumber && `Number ${read.docNumber}`, read?.expiry && `valid until ${read.expiry.split("-").reverse().join("/")}`].filter(Boolean);
      if (parts.length && notesRef.current && !notesRef.current.value) notesRef.current.value = parts.join(", ");
    }
  }

  function handleRemove(entryId: string) {
    const formData = new FormData();
    formData.append("employeeId", employeeId);
    formData.append("visaApplicationId", entryId);
    startTransition(() => {
      removeVisaApplicationAction(formData);
    });
  }

  return (
    <section>
      <h2 className="mb-3 text-sm font-semibold text-primary">Visa History</h2>
      <div className="card p-5">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
          <div>
            <span className="mb-1 block text-xs font-medium text-muted">Stage</span>
            <Select
              key={`stage-${formKey}`}
              placeholder="Select stage"
              options={stages.map((s) => ({ value: s.value, label: s.value }))}
              onChange={(v) => {
                stageRef.current = v;
              }}
            />
          </div>
          <div>
            <span className="mb-1 block text-xs font-medium text-muted">Date</span>
            <DatePicker key={resetKey} inputRef={dateRef} className="w-full" />
          </div>
          <div>
            <span className="mb-1 block text-xs font-medium text-muted">Link document</span>
            <Select
              key={`doc-${formKey}`}
              placeholder="None"
              options={documents.map((d) => ({ value: d.id, label: d.filename }))}
              onChange={(v) => {
                documentRef.current = v;
              }}
            />
          </div>
          <div className="flex items-end">
            <button
              type="button"
              onClick={handleAdd}
              disabled={pending}
              className="btn btn-primary w-full"
            >
              Add
            </button>
          </div>
          <div className="sm:col-span-4">
            <span className="mb-1 block text-xs font-medium text-muted">Notes</span>
            <textarea
              ref={notesRef}
              rows={2}
              className="input w-full"
            />
          </div>
          <div className="sm:col-span-4">
            <span className="mb-1 block text-xs font-medium text-muted">Attach a file <span className="font-normal">(optional, PDF or image; saved under Documents and linked to this entry)</span></span>
            <div className="flex flex-wrap items-center gap-2">
              <input ref={fileRef} type="file" accept="image/*,application/pdf" className="sr-only" id={`attach-${employeeId}-${stages.length}-${entries.length}`} onChange={(e) => onPick(e.target.files?.[0] ?? null)} />
              <label htmlFor={`attach-${employeeId}-${stages.length}-${entries.length}`} className="btn btn-secondary inline-flex cursor-pointer items-center gap-1.5"><Paperclip className="h-4 w-4" aria-hidden />{file ? "Change file" : "Attach file"}</label>
              {file && (
                <span className="inline-flex items-center gap-1.5 text-sm text-secondary">
                  {file.name}
                  <button type="button" aria-label="Remove attached file" className="text-muted hover:text-primary" onClick={() => { setFile(null); if (fileRef.current) fileRef.current.value = ""; }}><X className="h-3.5 w-3.5" aria-hidden /></button>
                </span>
              )}
              {file && <span className="text-xs text-muted">This replaces &ldquo;Link document&rdquo;.</span>}
            </div>
          </div>
          {error && <Alert className="sm:col-span-4">{error}</Alert>}
        </div>

        {entries.length === 0 ? (
          <p className="mt-4 text-sm text-subtle">No visa history recorded yet.</p>
        ) : (
          <table className="mt-4 w-full text-sm">
            <thead className="border-b border-default text-left text-xs font-medium tracking-wide text-muted uppercase">
              <tr>
                <th className="py-2">Stage</th>
                <th className="py-2">Date</th>
                <th className="py-2">Notes</th>
                <th className="py-2">Document</th>
                <th className="py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {entries.map((e) => {
                const doc = documents.find((d) => d.id === e.documentId);
                return (
                  <tr key={e.id}>
                    <td className="py-2 font-medium text-primary">{e.stage}</td>
                    <td className="py-2 text-secondary">{formatDate(e.date)}</td>
                    <td className="py-2 text-secondary">{e.notes || "—"}</td>
                    <td className="py-2 text-secondary">
                      {doc ? (
                        <a
                          href={`/api/documents/${doc.id}`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-[var(--brand-primary)] hover:underline"
                        >
                          {doc.filename}
                        </a>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="py-2 text-right">
                      <button
                        type="button"
                        disabled={pending}
                        onClick={() => handleRemove(e.id)}
                        className="text-xs font-medium text-[var(--error)] hover:underline disabled:opacity-60"
                      >
                        Remove
                      </button>
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
