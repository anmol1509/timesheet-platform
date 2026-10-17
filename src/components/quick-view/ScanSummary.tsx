"use client";

import { X } from "lucide-react";

/** What a scan did to a record, shown the same way for every quick view. */
export type ScanSummaryData = {
  applied: { key: string; label: string; value: string }[];
  /** The scan disagrees with what is on the record: the person chooses, nothing is overwritten. */
  conflicts: { key: string; label: string; current: string; scan: string }[];
  files: number;
  /** Files that were saved but whose details couldn't be read. */
  unread: number;
  reason: string | null;
  photo?: boolean;
};

export function ScanSummary({ outcome, onUse, onDismiss }: { outcome: ScanSummaryData; onUse: (c: ScanSummaryData["conflicts"][number]) => void; onDismiss: () => void }) {
  const nothing = outcome.applied.length === 0 && outcome.conflicts.length === 0 && !outcome.photo;
  return (
    <div role="status" className="rounded-[14px] border border-default bg-surface-subtle p-3 text-sm">
      <div className="flex items-start justify-between gap-2">
        <p className="font-semibold text-primary">
          {outcome.applied.length > 0 ? `Read ${outcome.files} file${outcome.files === 1 ? "" : "s"} and added ${outcome.applied.length} detail${outcome.applied.length === 1 ? "" : "s"}` : nothing ? "Nothing new to add" : `Read ${outcome.files} file${outcome.files === 1 ? "" : "s"}`}
        </p>
        <button type="button" onClick={onDismiss} aria-label="Dismiss" className="shrink-0 text-subtle hover:text-primary"><X className="h-4 w-4" aria-hidden /></button>
      </div>
      {outcome.applied.length > 0 && (
        <ul className="mt-1.5 flex flex-wrap gap-1.5">
          {outcome.applied.map((a) => <li key={a.key} className="rounded-full bg-[var(--success-soft)] px-2 py-0.5 text-xs text-[var(--success)]">✓ {a.label}</li>)}
          {outcome.photo && <li className="rounded-full bg-[var(--success-soft)] px-2 py-0.5 text-xs text-[var(--success)]">✓ Photo</li>}
        </ul>
      )}
      {nothing && outcome.unread === 0 && <p className="mt-1 text-xs text-muted">What the scan shows is already on the profile.</p>}
      {outcome.unread > 0 && (
        <p className="mt-1.5 text-xs text-[var(--warning)]">{outcome.unread === 1 ? "A file was saved but its details couldn't be read" : `${outcome.unread} files were saved but their details couldn't be read`}{outcome.reason ? ` (${outcome.reason})` : ""}. Enter the details by hand.</p>
      )}
      {outcome.conflicts.map((c) => (
        <div key={c.key} className="mt-2 rounded-lg border border-[var(--warning-border)] bg-[var(--warning-soft)] p-2 text-xs">
          <p className="text-primary"><b>{c.label}</b>: the profile has <b>{c.current}</b>, the scan says <b>{c.scan}</b>.</p>
          <button type="button" onClick={() => onUse(c)} className="mt-1 font-semibold text-[var(--brand-primary)] hover:underline">Use the scan value</button>
        </div>
      ))}
    </div>
  );
}

