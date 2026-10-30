"use client";

import { useCanHere } from "@/components/PermissionsProvider";
import { useEffect, useRef, useState } from "react";
import * as Popover from "@radix-ui/react-popover";
import { Check, ChevronDown, Download, Loader2, X } from "lucide-react";

export type ExportFormat = "xlsx" | "csv";

/**
 * The one Export control: a button that offers Excel or CSV, then shows the same preparing and tick animation as the other
 * action buttons while the file is made. `onExport` does the work and may be slow; if it throws, the button shows "Failed" and
 * `onError` can say why.
 */
export function ExportMenu({
  onExport,
  onError,
  label = "Export",
  className = "btn btn-secondary btn-sm",
  tableToolbar = false,
}: {
  onExport: (format: ExportFormat) => Promise<void> | void;
  onError?: (message: string) => void;
  label?: string;
  className?: string;
  /** Match the compact toolbar buttons of a table instead of the page's action buttons. */
  tableToolbar?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const mayExport = useCanHere("export");
  const [busy, setBusy] = useState(false);
  const [outcome, setOutcome] = useState<"done" | "failed" | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  async function pick(format: ExportFormat) {
    setOpen(false);
    setBusy(true);
    setOutcome(null);
    try {
      await onExport(format);
      setOutcome("done");
    } catch (e) {
      setOutcome("failed");
      onError?.(e instanceof Error ? e.message : "That file couldn't be made.");
    } finally {
      setBusy(false);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setOutcome(null), 1600);
    }
  }

  if (!mayExport) return null;
  const item = "flex w-full items-center rounded-sm px-2.5 py-1.5 text-left text-[13px] text-secondary transition hover:bg-surface-hover hover:text-primary";
  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button
          type="button"
          disabled={busy}
          aria-busy={busy}
          className={`${tableToolbar ? "btn btn-secondary btn-sm h-9" : className} btn-fx`}
          data-variant="secondary"
          data-state={outcome === "done" ? "success" : outcome === "failed" ? "error" : busy ? "loading" : "idle"}
        >
          <span className="ab-swap">
            <span data-on={(!busy && !outcome) || undefined}><Download className="h-3.5 w-3.5 shrink-0" aria-hidden />{label}<ChevronDown className="h-3 w-3 shrink-0 text-muted" aria-hidden /></span>
            <span data-on={(busy && !outcome) || undefined} aria-hidden={!busy}><Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden />Preparing…</span>
            <span data-on={outcome === "done" || undefined} aria-hidden={outcome !== "done"}><Check className="h-4 w-4 shrink-0" strokeWidth={3} aria-hidden />Downloaded</span>
            <span data-on={outcome === "failed" || undefined} aria-hidden={outcome !== "failed"}><X className="h-4 w-4 shrink-0" strokeWidth={3} aria-hidden />Failed</span>
          </span>
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content align={tableToolbar ? "end" : "start"} sideOffset={6} className="rx-popover z-50 w-44 rounded-card border border-default bg-surface p-1 shadow-popover">
          <button type="button" className={item} onClick={() => void pick("xlsx")}>Excel (.xlsx)</button>
          <button type="button" className={item} onClick={() => void pick("csv")}>CSV (.csv)</button>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
