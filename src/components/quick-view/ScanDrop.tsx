"use client";

import { useRef, useState } from "react";
import { Loader2, ScanLine } from "lucide-react";
import { cn } from "@/lib/cn";
import { Alert } from "@/components/Alert";

/**
 * The drop zone every scan control uses: click or drop a file, see progress while it is read. What happens to the
 * files (reading, filing, filling the record) belongs to the caller, which passes `onFiles` and reports back in
 * `status` (progress text while busy) and `error`.
 */
export function ScanDrop({ title, hint, compact, multiple, status, error, onFiles, onCancel }: {
  title?: string;
  hint?: string;
  compact?: boolean;
  multiple?: boolean;
  /** Progress text while the caller is working; null when idle. */
  status: string | null;
  error?: string | null;
  onFiles: (files: File[]) => void;
  /** Shown while busy: stops reading and saving. Files already saved stay. */
  onCancel?: () => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const busy = status !== null;
  return (
    <div>
      <div className="flex items-center gap-2">
      <label
        onDragOver={(e) => { e.preventDefault(); setOver(true); }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => { e.preventDefault(); setOver(false); if (!busy) onFiles([...e.dataTransfer.files].slice(0, multiple ? 8 : 1)); }}
        className={cn("flex min-w-0 flex-1 cursor-pointer items-center gap-3 rounded-[14px] border border-dashed px-3 text-sm transition", compact ? "py-2.5" : "py-4", over ? "border-[var(--brand-primary)] bg-brand-soft" : "border-[var(--border-strong,var(--border))] hover:bg-surface-hover", busy && "pointer-events-none opacity-80")}
      >
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-soft text-[var(--brand-primary)]">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <ScanLine className="h-4 w-4" aria-hidden />}
        </span>
        <span className="min-w-0">
          <span className="block font-medium text-primary">{busy ? status : (title ?? "Scan or upload")}</span>
          {!busy && <span className="block text-xs text-muted">{hint ?? "Drop a file or click. Details are read and filled in for you."}</span>}
        </span>
        <input ref={input} type="file" className="sr-only" accept="image/*,application/pdf" multiple={multiple} disabled={busy} onChange={(e) => { const f = [...(e.target.files ?? [])]; if (input.current) input.current.value = ""; onFiles(f); }} />
      </label>
      {busy && onCancel && <button type="button" onClick={onCancel} className="btn btn-secondary btn-sm shrink-0">Cancel</button>}
      </div>
      {error && <Alert inline className="mt-1">{error}</Alert>}
    </div>
  );
}
