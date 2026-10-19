"use client";

import { Download, Printer } from "lucide-react";

/** Download the report as Excel, or print it (the browser's print dialog also saves as PDF). */
export function ExportBar({ query, canExport }: { query: string; canExport: boolean }) {
  return (
    <div className="flex flex-wrap gap-2" data-print-hide>
      {canExport && (
        <a href={`/finance/books/reports/export?${query}`} className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-default px-3 text-xs font-medium text-primary hover:bg-surface-hover">
          <Download className="h-3.5 w-3.5" aria-hidden /> Excel
        </a>
      )}
      <button type="button" onClick={() => window.print()} className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-default px-3 text-xs font-medium text-primary hover:bg-surface-hover">
        <Printer className="h-3.5 w-3.5" aria-hidden /> Print / PDF
      </button>
    </div>
  );
}
