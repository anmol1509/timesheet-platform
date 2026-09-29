"use client";

import { useRef, useState } from "react";
import { parseSpreadsheetFile, remapHeaders } from "@/lib/spreadsheet";
import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { ResultSection, Tile, type ImportRowResult } from "@/components/import/report";
import { Dialog, DialogTrigger, DialogContent } from "@/components/ui/Dialog";

export type ImportColumn = { key: string; label: string; required?: boolean; aliases?: string[] };
export type { ImportNote, ImportRowResult } from "@/components/import/report";

export function CsvImportDialog({
  entityLabel,
  columns,
  importAction,
  onDone,
  wizardHref,
}: {
  wizardHref?: string;
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
    let parsed: Record<string, string>[];
    try {
      parsed = await parseSpreadsheetFile(file);
    } catch {
      setError("That file couldn't be read. Use an Excel (.xlsx) or CSV file.");
      setRows([]);
      return;
    }
    parsed = remapHeaders(parsed, columns);
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
  const skippedCount = results?.filter((r) => r.status === "skipped").length ?? 0;
  const errorRows = results?.filter((r) => r.status === "error") ?? [];
  const withNotes = (results ?? []).filter(
    (r) => r.status !== "error" && r.status !== "skipped" && ((r.notes && r.notes.length > 0) || r.message)
  );
  const noteTone = (r: ImportRowResult) => (r.notes ?? []).some((n) => n.tone === "warn");
  const checkRows = withNotes.filter(noteTone);
  const infoRows = withNotes.filter((r) => !noteTone(r));

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
          className="btn btn-secondary px-3"
        >
          Import Excel / CSV
        </button>
      </DialogTrigger>
      <DialogContent title={`Import ${entityLabel}`} className="max-h-[85vh] max-w-2xl overflow-y-auto">
        {!results && (
          <>
            <p className="mt-3 mb-3 text-sm text-muted">
              Upload an Excel (.xlsx) or CSV file with a header row. Existing records are matched and
              updated; new ones are created.
            </p>
            {wizardHref && (
              <p className="mb-3 rounded-lg bg-surface-subtle px-3 py-2 text-xs text-secondary">
                Want to see what will happen before anything is saved, and be able to undo it?{" "}
                <a href={wizardHref} className="font-medium text-[var(--brand-primary)] hover:underline">Use the import wizard</a>.
              </p>
            )}
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
              accept=".xlsx,.csv,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleFile(file);
              }}
              className="mb-4 file-input"
            />
            {error && (
              <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
                {error}
              </p>
            )}
            {rows.length > 0 && (
              <>
                <p className="mb-2 text-sm text-secondary">
                  <span className="font-medium text-primary">{fileName}</span> —{" "}
                  {rows.length} row{rows.length === 1 ? "" : "s"} ready to import.
                </p>
                <div className="mb-4 max-h-48 overflow-auto rounded-lg border border-default">
                  <table className="w-full text-xs">
                    <thead className="bg-surface-subtle text-left text-muted">
                      <tr>
                        {columns.map((c) => (
                          <th key={c.key} className="px-2 py-1.5">
                            {c.label}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--border)]">
                      {rows.slice(0, 5).map((r, i) => (
                        <tr key={i}>
                          {columns.map((c) => (
                            <td key={c.key} className="px-2 py-1.5 text-secondary">
                              {r[c.label] ?? ""}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {rows.length > 5 && (
                    <p className="px-2 py-1.5 text-xs text-subtle">
                      + {rows.length - 5} more
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  disabled={importing}
                  onClick={handleImport}
                  className="btn btn-primary"
                >
                  {importing ? "Importing…" : `Import ${rows.length} row${rows.length === 1 ? "" : "s"}`}
                </button>
              </>
            )}
          </>
        )}

        {results && (
          <div className="mt-3 space-y-4">
            <div className="flex items-center gap-2">
              {errorRows.length === 0 ? (
                <CheckCircle2 className="h-5 w-5 text-[var(--success)]" aria-hidden />
              ) : (
                <AlertTriangle className="h-5 w-5 text-[var(--warning)]" aria-hidden />
              )}
              <p className="text-sm font-semibold text-primary">
                {errorRows.length === 0 ? "Import finished" : "Import finished with some failed rows"}
                {fileName && <span className="ml-2 font-normal text-muted">{fileName}</span>}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <Tile label="Created" value={createdCount} tone="success" />
              <Tile label="Updated" value={updatedCount} tone="info" />
              <Tile label="Merged" value={skippedCount} tone="neutral" hint="repeated rows" />
              <Tile label="Failed" value={errorRows.length} tone={errorRows.length > 0 ? "error" : "neutral"} />
            </div>

            <ResultSection
              title="Failed rows"
              help="These were not imported. Fix them in your file and upload again."
              items={errorRows}
              tone="error"
              defaultOpen
            />
            <ResultSection
              title="Worth checking"
              help="Imported, but you may want to confirm these."
              items={checkRows}
              tone="warn"
              defaultOpen
            />
            <ResultSection
              title="For your information"
              help="Things the import did for you."
              items={infoRows}
              tone="info"
              defaultOpen={false}
            />

            <div className="flex gap-2 border-t border-default pt-3">
              <button type="button" onClick={reset} className="btn btn-secondary">
                Import another file
              </button>
              <button type="button" onClick={() => setOpen(false)} className="btn btn-primary">
                Done
              </button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
