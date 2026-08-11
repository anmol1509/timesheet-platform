"use client";

import { useRef, useState } from "react";
import { parseCsv } from "@/lib/csv";
import { Dialog, DialogTrigger, DialogContent } from "@/components/ui/Dialog";

export type ImportColumn = { key: string; label: string; required?: boolean };
export type ImportRowResult = { row: number; status: "created" | "updated" | "error"; message?: string };

export function CsvImportDialog({
  entityLabel,
  columns,
  importAction,
  onDone,
}: {
  entityLabel: string;
  columns: ImportColumn[];
  importAction: (rows: Record<string, string>[]) => Promise<ImportRowResult[]>;
  onDone?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<Record<string, string>[]>([]);
  const [fileName, setFileName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<ImportRowResult[] | null>(null);
  const [importing, setImporting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  function reset() {
    setRows([]);
    setFileName("");
    setError(null);
    setResults(null);
    if (fileRef.current) fileRef.current.value = "";
  }

  async function handleFile(file: File) {
    setError(null);
    setResults(null);
    const text = await file.text();
    const parsed = parseCsv(text);
    if (parsed.length === 0) {
      setError("No data rows found in that file.");
      setRows([]);
      return;
    }
    const missing = columns
      .filter((c) => c.required)
      .filter((c) => !(c.label in parsed[0]));
    if (missing.length > 0) {
      setError(
        `Missing required column(s): ${missing.map((c) => c.label).join(", ")}.`
      );
      setRows([]);
      return;
    }
    setFileName(file.name);
    setRows(parsed);
  }

  async function handleImport() {
    setImporting(true);
    try {
      const res = await importAction(rows);
      setResults(res);
      if (res.every((r) => r.status !== "error")) {
        onDone?.();
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Import failed.");
    } finally {
      setImporting(false);
    }
  }

  function downloadTemplate() {
    const header = columns.map((c) => c.label).join(",");
    const blob = new Blob(["﻿" + header + "\r\n"], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${entityLabel}-import-template.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  const createdCount = results?.filter((r) => r.status === "created").length ?? 0;
  const updatedCount = results?.filter((r) => r.status === "updated").length ?? 0;
  const errorRows = results?.filter((r) => r.status === "error") ?? [];

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) reset();
      }}
    >
      <DialogTrigger asChild>
        <button
          type="button"
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
        >
          Import CSV
        </button>
      </DialogTrigger>
      <DialogContent title={`Import ${entityLabel}`} className="max-h-[85vh] max-w-2xl overflow-y-auto">
        {!results && (
          <>
            <p className="mt-3 mb-3 text-sm text-slate-500">
              Upload a CSV with a header row. Existing records are matched and
              updated; new ones are created.
            </p>
            <button
              type="button"
              onClick={downloadTemplate}
              className="mb-4 text-sm font-medium text-blue-600 hover:underline"
            >
              Download template
            </button>
            <input
              ref={fileRef}
              type="file"
              accept=".csv,text/csv"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleFile(file);
              }}
              className="mb-4 block text-sm text-slate-500 file:mr-3 file:cursor-pointer file:rounded-lg file:border file:border-slate-300 file:bg-white file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-slate-700 file:transition hover:file:bg-slate-50"
            />
            {error && (
              <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
                {error}
              </p>
            )}
            {rows.length > 0 && (
              <>
                <p className="mb-2 text-sm text-slate-600">
                  <span className="font-medium text-slate-900">{fileName}</span> —{" "}
                  {rows.length} row{rows.length === 1 ? "" : "s"} ready to import.
                </p>
                <div className="mb-4 max-h-48 overflow-auto rounded-lg border border-slate-200">
                  <table className="w-full text-xs">
                    <thead className="bg-slate-50 text-left text-slate-500">
                      <tr>
                        {columns.map((c) => (
                          <th key={c.key} className="px-2 py-1.5">
                            {c.label}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {rows.slice(0, 5).map((r, i) => (
                        <tr key={i}>
                          {columns.map((c) => (
                            <td key={c.key} className="px-2 py-1.5 text-slate-600">
                              {r[c.label] ?? ""}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {rows.length > 5 && (
                    <p className="px-2 py-1.5 text-xs text-slate-400">
                      + {rows.length - 5} more
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  disabled={importing}
                  onClick={handleImport}
                  className="rounded-lg bg-[var(--brand-primary)] px-4 py-2 text-sm font-medium text-white transition hover:bg-[var(--brand-primary-hover)] disabled:opacity-60"
                >
                  {importing ? "Importing…" : `Import ${rows.length} row${rows.length === 1 ? "" : "s"}`}
                </button>
              </>
            )}
          </>
        )}

        {results && (
          <div className="mt-3 space-y-3">
            <p className="text-sm text-slate-700">
              {createdCount} created, {updatedCount} updated, {errorRows.length} failed.
            </p>
            {errorRows.length > 0 && (
              <div className="max-h-48 overflow-auto rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700">
                {errorRows.map((r) => (
                  <p key={r.row}>
                    Row {r.row}: {r.message || "Unknown error"}
                  </p>
                ))}
              </div>
            )}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={reset}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Import another file
              </button>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-lg bg-[var(--brand-primary)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--brand-primary-hover)]"
              >
                Done
              </button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
