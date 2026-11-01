"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AlertCircle, Check, FileSpreadsheet, FileText, X } from "lucide-react";
import { cn } from "@/lib/cn";

export type TileState = "queued" | "reading" | "done" | "failed";
export type UploadTile = {
  id: string;
  name: string;
  kind: "image" | "pdf" | "sheet";
  /** A small picture of the file, for images. */
  thumb?: string;
  state: TileState;
  /** Replaces the word under the tile ("Filed, not read"). */
  note?: string;
};

const LABEL: Record<TileState, string> = { queued: "Waiting", reading: "Reading…", done: "Filed", failed: "Not added" };

function kindOf(f: File): UploadTile["kind"] {
  if (f.type.startsWith("image/")) return "image";
  return /\.(xlsx?|csv)$/i.test(f.name) ? "sheet" : "pdf";
}

/**
 * The state of the files being uploaded, as tiles: `start` with the picked files, `set` a tile as each one moves on, `clear` to dismiss.
 * Pictures get a thumbnail made from the file itself; those object URLs are released when they are replaced or the screen goes.
 */
export function useUploadTiles() {
  const [tiles, setTiles] = useState<UploadTile[]>([]);
  const urls = useRef<string[]>([]);
  const release = useCallback(() => { urls.current.forEach((u) => URL.revokeObjectURL(u)); urls.current = []; }, []);
  useEffect(() => release, [release]);
  const start = useCallback((files: File[]) => {
    release();
    setTiles(files.map((f, i) => {
      const kind = kindOf(f);
      let thumb: string | undefined;
      if (kind === "image") { thumb = URL.createObjectURL(f); urls.current.push(thumb); }
      return { id: `${i}-${f.name}`, name: f.name, kind, thumb, state: "queued" as const };
    }));
  }, [release]);
  const set = useCallback((index: number, patch: Partial<Pick<UploadTile, "state" | "note">>) => {
    setTiles((cur) => cur.map((t, i) => (i === index ? { ...t, ...patch } : t)));
  }, []);
  /** Marks whatever was still being read as not added (the upload broke part-way). */
  const failReading = useCallback(() => {
    setTiles((cur) => cur.map((t) => (t.state === "reading" ? { ...t, state: "failed" as const, note: "Not saved" } : t)));
  }, []);
  const clear = useCallback(() => { release(); setTiles([]); }, [release]);
  return { tiles, start, set, failReading, clear };
}

function Tile({ t, onRemove }: { t: UploadTile; onRemove?: (id: string) => void }) {
  const Icon = t.kind === "sheet" ? FileSpreadsheet : FileText;
  const stroke = t.state === "failed" ? "var(--error)" : t.state === "done" ? "var(--success)" : "var(--brand-primary)";
  return (
    <li className="w-[72px]">
      <div className={cn("relative h-[72px] w-[72px] overflow-hidden rounded-[14px] bg-surface-sunken", t.state === "failed" && "bg-[var(--error-soft)]")}>
        {t.thumb ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={t.thumb} alt="" className={cn("h-full w-full object-cover transition", t.state === "queued" && "opacity-60 grayscale")} />
        ) : (
          <span className={cn("flex h-full w-full items-center justify-center", t.state === "failed" ? "text-[var(--error)]" : "text-muted")}>
            <Icon className="h-7 w-7" strokeWidth={1.5} aria-hidden />
          </span>
        )}
        <svg viewBox="0 0 72 72" className="pointer-events-none absolute inset-0" aria-hidden>
          {t.state === "queued" && <rect x="1.5" y="1.5" width="69" height="69" rx="13" pathLength={100} fill="none" stroke="var(--border)" strokeWidth="2" />}
          {t.state === "reading" && <rect x="1.5" y="1.5" width="69" height="69" rx="13" pathLength={100} fill="none" stroke={stroke} strokeWidth="3" strokeLinecap="round" className="tile-chase" />}
          {(t.state === "done" || t.state === "failed") && <rect x="1.5" y="1.5" width="69" height="69" rx="13" pathLength={100} fill="none" stroke={stroke} strokeWidth="3" strokeLinecap="round" strokeDasharray="100 0" className="tile-settle" />}
        </svg>
        {t.state === "done" && (
          <span className="tile-pop absolute right-1 bottom-1 flex h-5 w-5 items-center justify-center rounded-full bg-[var(--success)] text-white shadow-sm"><Check className="h-3 w-3" strokeWidth={3.5} aria-hidden /></span>
        )}
        {t.state === "failed" && (
          <span className="tile-pop absolute right-1 bottom-1 flex h-5 w-5 items-center justify-center rounded-full bg-[var(--error)] text-white shadow-sm"><AlertCircle className="h-3 w-3" strokeWidth={3} aria-hidden /></span>
        )}
        {onRemove && (
          <button type="button" aria-label={`Remove ${t.name}`} onClick={() => onRemove(t.id)} className="absolute top-1 right-1 flex h-[18px] w-[18px] items-center justify-center rounded-full bg-black/55 text-white backdrop-blur-sm transition hover:bg-black/75">
            <X className="h-3 w-3" strokeWidth={3} aria-hidden />
          </button>
        )}
      </div>
      <p className="mt-1.5 truncate text-[11px] font-medium text-primary" title={t.name}>{t.name}</p>
      <p className={cn("truncate text-[10.5px]", t.state === "failed" ? "text-[var(--error)]" : t.state === "done" ? "text-[var(--success)]" : "text-muted")} title={t.note}>{t.note ?? LABEL[t.state]}</p>
    </li>
  );
}

/** A row of file tiles. The ring chases around a file while it is read and settles with a tick (or a red mark) when it is done. */
export function UploadTiles({ tiles, onRemove, className }: { tiles: UploadTile[]; onRemove?: (id: string) => void; className?: string }) {
  if (tiles.length === 0) return null;
  return (
    <ul className={cn("flex flex-wrap gap-3.5", className)} aria-live="polite">
      {tiles.map((t) => <Tile key={t.id} t={t} onRemove={onRemove} />)}
    </ul>
  );
}
