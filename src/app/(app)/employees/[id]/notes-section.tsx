"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { FileText, Plus } from "lucide-react";
import { DeleteButton } from "@/components/DeleteButton";
import { UPLOAD_ACCEPT_ATTR } from "@/lib/uploads";
import { MAX_UPLOAD_LABEL } from "@/lib/constants";
import { addEmployeeNoteAction, deleteEmployeeNoteAction } from "./actions";

type NoteRow = {
  id: string;
  remarks: string;
  createdAt: string;
  createdByName: string;
  documents: { id: string; filename: string }[];
};

/**
 * The employee's running record of notes.
 *
 * The wizard collects these at registration, but nothing on this page read
 * them back, so a note written during onboarding vanished from view the moment
 * it was saved.
 */
export function NotesSection({
  employeeId,
  notes,
}: {
  employeeId: string;
  notes: NoteRow[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [adding, setAdding] = useState(false);
  const [remarks, setRemarks] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  function submit() {
    const body = new FormData();
    body.set("employeeId", employeeId);
    body.set("remarks", remarks);
    for (const file of fileRef.current?.files ?? []) body.append("files", file);

    startTransition(async () => {
      await addEmployeeNoteAction(body);
      setRemarks("");
      if (fileRef.current) fileRef.current.value = "";
      setAdding(false);
      router.refresh();
    });
  }

  return (
    <section>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-primary">
          Notes{notes.length > 0 && <span className="ml-1.5 text-muted">{notes.length}</span>}
        </h2>
        {!adding && (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="btn btn-secondary px-3 py-1 text-xs"
          >
            <Plus className="h-3.5 w-3.5" aria-hidden />
            Add note
          </button>
        )}
      </div>

      <div className="card p-5">
        {adding && (
          <div className="mb-4 rounded-card border border-default p-4">
            <label className="block">
              <span className="field-label">Remarks</span>
              <textarea
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                rows={3}
                placeholder="What happened, or what should the next person know?"
                className="input w-full"
              />
            </label>
            <label className="mt-3 block">
              <span className="field-label">Attachments</span>
              <input
                ref={fileRef}
                type="file"
                multiple
                accept={UPLOAD_ACCEPT_ATTR}
                className="file-input"
              />
              <span className="mt-1 block text-xs text-subtle">
                Max {MAX_UPLOAD_LABEL} each.
              </span>
            </label>
            <div className="mt-3 flex items-center gap-2">
              <button
                type="button"
                onClick={submit}
                disabled={pending}
                className="btn btn-primary px-3 py-1 text-xs"
              >
                {pending ? "Saving…" : "Save note"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setAdding(false);
                  setRemarks("");
                }}
                className="btn btn-secondary px-3 py-1 text-xs"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {notes.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted">
            No notes on file for this worker.
          </p>
        ) : (
          <ul className="divide-y divide-[var(--border)]">
            {notes.map((note) => (
              <li key={note.id} className="flex gap-3 py-3 first:pt-0 last:pb-0">
                <div className="min-w-0 flex-1">
                  <p className="text-sm whitespace-pre-wrap text-primary">
                    {note.remarks || <span className="text-subtle">No remarks</span>}
                  </p>
                  {note.documents.length > 0 && (
                    <ul className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1">
                      {note.documents.map((doc) => (
                        <li key={doc.id}>
                          <a
                            href={`/api/documents/${doc.id}`}
                            className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:underline"
                          >
                            <FileText className="h-3 w-3" aria-hidden />
                            {doc.filename}
                          </a>
                        </li>
                      ))}
                    </ul>
                  )}
                  <p className="mt-1 text-xs text-subtle">
                    {new Date(note.createdAt).toLocaleDateString("en-GB", {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                    })}{" "}
                    · {note.createdByName}
                  </p>
                </div>
                <DeleteButton
                  action={deleteEmployeeNoteAction}
                  hiddenFields={{ noteId: note.id, employeeId }}
                  confirmMessage={`Delete this note?${
                    note.documents.length > 0
                      ? ` Its ${note.documents.length} attachment(s) go too.`
                      : ""
                  }`}
                />
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
