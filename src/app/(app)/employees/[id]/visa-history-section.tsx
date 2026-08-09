"use client";

import { useRef, useState, useTransition } from "react";
import { Select } from "@/components/ui/Select";
import { addVisaApplicationAction, removeVisaApplicationAction } from "./actions";

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

  function handleAdd() {
    const stage = stageRef.current;
    if (!stage) return;
    const formData = new FormData();
    formData.append("employeeId", employeeId);
    formData.append("stage", stage);
    if (dateRef.current?.value) formData.append("date", dateRef.current.value);
    if (notesRef.current?.value) formData.append("notes", notesRef.current.value);
    if (documentRef.current) formData.append("documentId", documentRef.current);
    startTransition(() => {
      addVisaApplicationAction(formData);
    });
    stageRef.current = "";
    documentRef.current = "";
    if (dateRef.current) dateRef.current.value = "";
    if (notesRef.current) notesRef.current.value = "";
    setFormKey((k) => k + 1);
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
      <h2 className="mb-3 text-sm font-semibold text-slate-900">Visa History</h2>
      <div className="rounded-3xl border border-slate-200 bg-white p-5">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
          <div>
            <span className="mb-1 block text-xs font-medium text-slate-500">Stage</span>
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
            <span className="mb-1 block text-xs font-medium text-slate-500">Date</span>
            <input
              ref={dateRef}
              type="date"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[var(--brand-primary)]"
            />
          </div>
          <div>
            <span className="mb-1 block text-xs font-medium text-slate-500">Link document</span>
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
              className="w-full rounded-lg bg-[var(--brand-primary)] px-4 py-2 text-sm font-medium text-white transition hover:bg-[var(--brand-primary-hover)] disabled:opacity-60"
            >
              Add
            </button>
          </div>
          <div className="sm:col-span-4">
            <span className="mb-1 block text-xs font-medium text-slate-500">Notes</span>
            <textarea
              ref={notesRef}
              rows={2}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[var(--brand-primary)]"
            />
          </div>
        </div>

        {entries.length === 0 ? (
          <p className="mt-4 text-sm text-slate-400">No visa history recorded yet.</p>
        ) : (
          <table className="mt-4 w-full text-sm">
            <thead className="border-b border-slate-100 text-left text-xs font-medium tracking-wide text-slate-500 uppercase">
              <tr>
                <th className="py-2">Stage</th>
                <th className="py-2">Date</th>
                <th className="py-2">Notes</th>
                <th className="py-2">Document</th>
                <th className="py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {entries.map((e) => {
                const doc = documents.find((d) => d.id === e.documentId);
                return (
                  <tr key={e.id}>
                    <td className="py-2 font-medium text-slate-900">{e.stage}</td>
                    <td className="py-2 text-slate-600">{formatDate(e.date)}</td>
                    <td className="py-2 text-slate-600">{e.notes || "—"}</td>
                    <td className="py-2 text-slate-600">
                      {doc ? (
                        <a
                          href={`/api/documents/${doc.id}`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-blue-600 hover:underline"
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
                        className="text-xs font-medium text-red-600 hover:underline disabled:opacity-60"
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
