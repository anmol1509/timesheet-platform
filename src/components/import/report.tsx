"use client";

import { useState } from "react";
import { AlertTriangle, CheckCircle2, ChevronDown, Info, XCircle } from "lucide-react";
import { cn } from "@/lib/cn";

export type ImportNote = { tone: "warn" | "info"; title: string; detail?: string };
export type ImportRowResult = {
  row: number;
  /** What the row was about (a supplier name), shown on its card. */
  name?: string;
  status: "created" | "updated" | "skipped" | "error";
  message?: string;
  notes?: ImportNote[];
};

const PREVIEW = 8;

export function Tile({ label, value, tone, hint }: { label: string; value: number; tone: "success" | "info" | "error" | "neutral"; hint?: string }) {
  const tones = {
    success: "border-[var(--success-border)] bg-[var(--success-soft)] text-[var(--success)]",
    info: "border-[var(--info-border)] bg-[var(--info-soft)] text-[var(--info)]",
    error: "border-[var(--error-border)] bg-[var(--error-soft)] text-[var(--error)]",
    neutral: "border-default bg-surface-subtle text-secondary",
  } as const;
  return (
    <div className={cn("rounded-xl border px-3 py-2.5", tones[tone])}>
      <div className="tabular text-2xl leading-none font-semibold">{value}</div>
      <div className="mt-1 text-xs font-medium">{label}</div>
      {hint && <div className="text-[11px] opacity-80">{hint}</div>}
    </div>
  );
}

export function RowCard({ result, tone }: { result: ImportRowResult; tone: "warn" | "info" | "error" }) {
  const accent = {
    warn: "border-l-[var(--warning)]",
    info: "border-l-[var(--info)]",
    error: "border-l-[var(--error)]",
  }[tone];
  const notes: ImportNote[] =
    result.notes && result.notes.length > 0
      ? result.notes
      : result.message
        ? [{ tone: tone === "error" ? "warn" : "info", title: result.message }]
        : [];
  return (
    <li className={cn("rounded-lg border border-default border-l-4 bg-surface p-3", accent)}>
      <div className="flex items-start justify-between gap-3">
        <p className="min-w-0 text-sm font-medium break-words text-primary">{result.name || `Row ${result.row}`}</p>
        {result.name && (
          <span className="tabular shrink-0 rounded-md bg-surface-sunken px-1.5 py-0.5 text-[11px] font-medium text-muted">
            Row {result.row}
          </span>
        )}
      </div>
      {tone === "error" ? (
        <p className="mt-1.5 flex items-start gap-1.5 text-xs text-[var(--error)]">
          <XCircle className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden />
          <span>{result.message || "Unknown error"}</span>
        </p>
      ) : (
        <ul className="mt-1.5 space-y-1.5">
          {notes.map((n, i) => (
            <li key={i} className="flex items-start gap-1.5 text-xs">
              {n.tone === "warn" ? (
                <AlertTriangle className="mt-px h-3.5 w-3.5 shrink-0 text-[var(--warning)]" aria-hidden />
              ) : (
                <Info className="mt-px h-3.5 w-3.5 shrink-0 text-[var(--info)]" aria-hidden />
              )}
              <span>
                <span className="font-medium text-primary">{n.title}</span>
                {n.detail && <span className="block text-muted">{n.detail}</span>}
              </span>
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}

export function ResultSection({
  title,
  help,
  items,
  tone,
  defaultOpen,
}: {
  title: string;
  help: string;
  items: ImportRowResult[];
  tone: "warn" | "info" | "error";
  defaultOpen: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const [all, setAll] = useState(false);
  if (items.length === 0) return null;
  const shown = all ? items : items.slice(0, PREVIEW);
  return (
    <section>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-2 rounded-lg px-1 py-1.5 text-left hover:bg-surface-hover"
      >
        <span>
          <span className="text-sm font-semibold text-primary">
            {title} <span className="tabular font-normal text-muted">· {items.length}</span>
          </span>
          <span className="block text-xs text-muted">{help}</span>
        </span>
        <ChevronDown className={cn("h-4 w-4 shrink-0 text-subtle transition-transform", open && "rotate-180")} aria-hidden />
      </button>
      {open && (
        <>
          <ul className="mt-2 space-y-2">
            {shown.map((r) => (
              <RowCard key={r.row} result={r} tone={tone} />
            ))}
          </ul>
          {items.length > PREVIEW && (
            <button type="button" onClick={() => setAll((v) => !v)} className="mt-2 text-xs font-medium text-[var(--brand-primary)] hover:underline">
              {all ? "Show fewer" : `Show all ${items.length}`}
            </button>
          )}
        </>
      )}
    </section>
  );
}


export type TileSpec = { label: string; value: number; tone: "success" | "info" | "error" | "neutral"; hint?: string };

/** Notes about the file as a whole, not tied to one row. */
export function NotesPanel({ notes }: { notes: { tone: "warn" | "info"; title: string; detail?: string }[] }) {
  if (notes.length === 0) return null;
  return (
    <section>
      <p className="px-1 text-sm font-semibold text-primary">About this file</p>
      <ul className="mt-2 space-y-2">
        {notes.map((n, i) => (
          <li key={i} className={cn("rounded-lg border border-default border-l-4 bg-surface p-3 text-xs", n.tone === "warn" ? "border-l-[var(--warning)]" : "border-l-[var(--info)]")}>
            <p className="flex items-start gap-1.5">
              {n.tone === "warn" ? (
                <AlertTriangle className="mt-px h-3.5 w-3.5 shrink-0 text-[var(--warning)]" aria-hidden />
              ) : (
                <Info className="mt-px h-3.5 w-3.5 shrink-0 text-[var(--info)]" aria-hidden />
              )}
              <span>
                <span className="font-medium text-primary">{n.title}</span>
                {n.detail && <span className="block text-muted">{n.detail}</span>}
              </span>
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Tiles, then failed rows, then what's worth checking, then the rest. Used by the wizard's review and result screens. */
export function ReportView({
  tiles,
  rows,
  notes,
  truncated,
}: {
  tiles: TileSpec[];
  rows: ImportRowResult[];
  notes: { tone: "warn" | "info"; title: string; detail?: string }[];
  truncated?: boolean;
}) {
  const failed = rows.filter((r) => r.status === "error");
  const withNotes = rows.filter((r) => r.status !== "error" && r.notes && r.notes.length > 0);
  const check = withNotes.filter((r) => r.notes!.some((n) => n.tone === "warn"));
  const info = withNotes.filter((r) => !r.notes!.some((n) => n.tone === "warn"));
  return (
    <div className="space-y-4">
      <div className={cn("grid grid-cols-2 gap-2", tiles.length >= 5 ? "sm:grid-cols-3 lg:grid-cols-6" : "sm:grid-cols-4")}>
        {tiles.map((t) => (
          <Tile key={t.label} label={t.label} value={t.value} tone={t.tone} hint={t.hint} />
        ))}
      </div>
      <NotesPanel notes={notes} />
      <ResultSection title="Failed rows" help="These will not be imported. Fix them in your file and upload again." items={failed} tone="error" defaultOpen />
      <ResultSection title="Worth checking" help="These import, but you may want to confirm them." items={check} tone="warn" defaultOpen />
      <ResultSection title="For your information" help="Things the import does for you." items={info} tone="info" defaultOpen={false} />
      {truncated && <p className="text-xs text-muted">Only the first rows that need attention are listed.</p>}
    </div>
  );
}
