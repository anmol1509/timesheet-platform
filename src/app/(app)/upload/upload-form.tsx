"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

type SkippedRow = {
  sheetName: string;
  row: number;
  name: string;
  idNo: string;
  reason: string;
};

type UploadStats = {
  monthsProcessed: { month: string; monthLabel: string; entries: number }[];
  suppliersCreated: number;
  clientsCreated: number;
  entriesCreated: number;
  entriesUpdated: number;
  rowsSkipped: number;
  skippedRowDetails: SkippedRow[];
};

type ImportWarning = {
  sheetName: string;
  employeeIdNo: string;
  employeeName: string;
  detail: string;
};

type UploadWarnings = {
  zeroRateCount: number;
  zeroRateSample: ImportWarning[];
  implausibleHoursCount: number;
  implausibleHoursSample: ImportWarning[];
};

type Result =
  | { kind: "success"; filename: string; stats: UploadStats; warnings: UploadWarnings }
  | { kind: "error"; message: string };

export function UploadForm() {
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  async function handleFile(file: File) {
    setBusy(true);
    setResult(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) {
        setResult({ kind: "error", message: data.error ?? "Upload failed." });
      } else {
        setResult({
          kind: "success",
          filename: file.name,
          stats: data.stats,
          warnings: data.warnings,
        });
        router.refresh();
      }
    } catch {
      setResult({ kind: "error", message: "Upload failed. Please try again." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          const file = e.dataTransfer.files?.[0];
          if (file) handleFile(file);
        }}
        onClick={() => inputRef.current?.click()}
        className={`flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed px-6 py-14 text-center transition ${
          dragging
            ? "border-slate-900 bg-slate-50"
            : "border-slate-300 bg-white hover:border-slate-400"
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".xlsx"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFile(file);
            e.target.value = "";
          }}
        />
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-xl">
          ↑
        </div>
        <p className="mt-4 text-sm font-medium text-slate-900">
          {busy ? "Uploading…" : "Drop your consolidated time sheet here"}
        </p>
        <p className="mt-1 text-xs text-slate-500">
          or click to browse — .xlsx files only
        </p>
      </div>

      {result?.kind === "error" && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {result.message}
        </div>
      )}

      {result?.kind === "success" && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-4 text-sm text-emerald-900">
          <p className="font-medium">
            Imported {result.filename} successfully.
          </p>
          <ul className="mt-3 space-y-1 text-emerald-800">
            {result.stats.monthsProcessed.map((m) => (
              <li key={m.month}>
                {m.monthLabel}: {m.entries} employee rows processed
              </li>
            ))}
            <li>
              {result.stats.entriesCreated} new, {result.stats.entriesUpdated}{" "}
              updated
              {result.stats.suppliersCreated > 0 &&
                `, ${result.stats.suppliersCreated} new companies`}
              {result.stats.clientsCreated > 0 &&
                `, ${result.stats.clientsCreated} new clients`}
            </li>
            {result.stats.rowsSkipped > 0 && (
              <li className="text-amber-700">
                {result.stats.rowsSkipped} row(s) skipped
              </li>
            )}
          </ul>
          {result.stats.skippedRowDetails.length > 0 && (
            <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3">
              <p className="text-xs font-medium text-amber-900">
                Skipped rows — fix these in the source sheet and re-upload:
              </p>
              <ul className="mt-2 space-y-1 text-xs text-amber-800">
                {result.stats.skippedRowDetails.map((r, i) => (
                  <li key={i}>
                    {r.sheetName}, row {r.row}: {r.name} ({r.idNo}) —{" "}
                    {r.reason}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {(result.warnings?.zeroRateCount > 0 ||
            result.warnings?.implausibleHoursCount > 0) && (
            <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3">
              <p className="text-xs font-medium text-amber-900">
                Worth reviewing before trusting this data:
              </p>
              <ul className="mt-2 space-y-2 text-xs text-amber-800">
                {result.warnings.zeroRateCount > 0 && (
                  <li>
                    <span className="font-medium">
                      {result.warnings.zeroRateCount} row(s) have a rate of 0
                    </span>{" "}
                    — usually means a column header wasn&rsquo;t recognized.
                    <ul className="mt-1 ml-3 list-disc space-y-0.5">
                      {result.warnings.zeroRateSample.map((w, i) => (
                        <li key={i}>
                          {w.sheetName}: {w.employeeName} ({w.employeeIdNo})
                        </li>
                      ))}
                    </ul>
                  </li>
                )}
                {result.warnings.implausibleHoursCount > 0 && (
                  <li>
                    <span className="font-medium">
                      {result.warnings.implausibleHoursCount} day(s) have an
                      unusual hour value
                    </span>{" "}
                    (negative, or over 24 hours in a day).
                    <ul className="mt-1 ml-3 list-disc space-y-0.5">
                      {result.warnings.implausibleHoursSample.map((w, i) => (
                        <li key={i}>
                          {w.sheetName}: {w.employeeName} ({w.employeeIdNo}) —{" "}
                          {w.detail}
                        </li>
                      ))}
                    </ul>
                  </li>
                )}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
