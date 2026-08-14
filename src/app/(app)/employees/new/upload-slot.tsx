"use client";

import { AlertTriangle, CheckCircle2, FileText, Loader2, X } from "lucide-react";
import { cn } from "@/lib/cn";

export type UploadStatus =
  | { kind: "idle" }
  | { kind: "reading" }
  | { kind: "filled"; message: string }
  | { kind: "error"; message: string };

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * File picker for one document slot.
 *
 * Declared at module scope on purpose: when this lived inside the wizard's
 * render, every setState created a new component type, React remounted the
 * <input type="file">, and the browser dropped the selected file — so nothing
 * was ever submitted. The chosen file is therefore held in the wizard's state
 * and re-attached to the form on submit via a DataTransfer-backed input.
 */
export function UploadSlot({
  id,
  label,
  hint,
  file,
  status,
  accept = "image/*,application/pdf",
  onSelect,
  onClear,
}: {
  id: string;
  label: string;
  hint?: string;
  file: File | null;
  status: UploadStatus;
  accept?: string;
  onSelect: (file: File | null) => void;
  onClear: () => void;
}) {
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-xs font-medium text-muted">
        {label}
      </label>

      {file ? (
        <div
          className={cn(
            "flex items-center gap-2.5 rounded-control border px-3 py-2",
            status.kind === "error"
              ? "border-[var(--error-border)] bg-[var(--error-soft)]"
              : status.kind === "filled"
                ? "border-[var(--success-border)] bg-[var(--success-soft)]"
                : "border-default bg-surface-subtle"
          )}
        >
          <FileText className="h-4 w-4 shrink-0 text-subtle" aria-hidden />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm text-primary">{file.name}</span>
            <span className="block text-xs text-muted">{formatSize(file.size)}</span>
          </span>
          <button
            type="button"
            onClick={onClear}
            aria-label={`Remove ${file.name}`}
            className="shrink-0 rounded-sm p-1 text-subtle transition hover:bg-surface-hover hover:text-secondary"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ) : (
        <input
          id={id}
          type="file"
          accept={accept}
          onChange={(e) => onSelect(e.target.files?.[0] ?? null)}
          className="file-input"
        />
      )}

      {hint && status.kind === "idle" && (
        <p className="mt-1 text-xs text-subtle">{hint}</p>
      )}

      {status.kind === "reading" && (
        <p className="mt-1 flex items-center gap-1.5 text-xs text-muted">
          <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
          Reading document…
        </p>
      )}

      {status.kind === "filled" && (
        <p className="mt-1 flex items-center gap-1.5 text-xs text-[var(--success)]">
          <CheckCircle2 className="h-3 w-3 shrink-0" aria-hidden />
          {status.message}
        </p>
      )}

      {status.kind === "error" && (
        <p className="mt-1 flex items-start gap-1.5 text-xs text-[var(--error)]">
          <AlertTriangle className="mt-px h-3 w-3 shrink-0" aria-hidden />
          <span>
            {status.message} The file is still attached — you can fill the
            fields in by hand.
          </span>
        </p>
      )}
    </div>
  );
}
