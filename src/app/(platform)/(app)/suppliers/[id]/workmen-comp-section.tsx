"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, FileText, Loader2, Plus, Trash2, Upload } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";
import { deleteWorkmenCompAction, setWorkmenCompExpiryAction } from "../actions";
import { ingestWorkmenComp } from "./workmen-comp-ingest";
import { WorkmenCompWorkers } from "./workmen-comp-workers";

export type WcPolicy = { id: string; filename: string; expiryDate: string | null; covered: number };
type Progress = { name: string; state: "waiting" | "working" | "done" | "failed"; note?: string };

const dayOf = (iso: string | null) => (iso ? iso.slice(0, 10) : "");
function status(iso: string | null) {
  if (!iso) return { text: "No expiry", cls: "text-muted" };
  const days = Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000);
  if (days < 0) return { text: `Expired ${-days}d ago`, cls: "text-error" };
  if (days <= 30) return { text: `Expires in ${days}d`, cls: "text-warning" };
  return { text: `Valid, ${days}d left`, cls: "text-success" };
}

/**
 * A supplier can hold several workmen compensation policies, each naming its own workers. Drop one or many
 * certificates: for each, the expiry date and the insured names are read from the file, the file is filed, and the
 * workers on this supplier named on it are linked to that certificate.
 */
export function WorkmenCompSection({ supplierId, policies, workers, canEdit, onChanged }: { supplierId: string; policies: WcPolicy[]; workers: number; canEdit: boolean; /** Called after a change instead of refreshing the page (the side panel reloads its own data). */ onChanged?: () => void }) {
  const router = useRouter();
  const changed = () => (onChanged ? onChanged() : router.refresh());
  // Policies whose workers are showing; a policy just added opens by itself so who is on it can be checked and linked at once.
  const [openIds, setOpenIds] = useState<Set<string>>(new Set());
  const toggle = (id: string) => setOpenIds((cur) => { const n = new Set(cur); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<Progress[]>([]);
  const [over, setOver] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [, start] = useTransition();
  const covered = policies.reduce((n, p) => n + p.covered, 0);

  async function addFiles(files: File[]) {
    if (files.length === 0) return;
    setBusy(true);
    setError(null);
    const added: string[] = [];
    const rows: Progress[] = files.map((f) => ({ name: f.name, state: "waiting" }));
    setProgress(rows);
    const set = (i: number, patch: Partial<Progress>) => setProgress((cur) => cur.map((r, j) => (j === i ? { ...r, ...patch } : r)));
    for (const [i, file] of files.entries()) {
      set(i, { state: "working" });
      try {
        const r = await ingestWorkmenComp(supplierId, file);
        if (!r.id) { set(i, { state: "failed", note: r.error ?? "Could not upload." }); continue; }
        added.push(r.id);
        const parts = [r.expiry ? `expires ${r.expiry}` : "no expiry date found", r.names.length > 0 ? `${r.linked} of ${r.names.length} named workers linked` : "no names found on it"];
        if (r.unmatched.length > 0) parts.push(`${r.unmatched.length} not on this company's roster`);
        set(i, { state: "done", note: parts.join(" · ") });
      } catch {
        set(i, { state: "failed", note: "Could not read or upload this file." });
      }
    }
    setBusy(false);
    if (added.length > 0) setOpenIds((cur) => new Set([...cur, ...added]));
    start(changed);
  }

  const run = (fn: () => Promise<{ error?: string }>) => start(async () => { const r = await fn(); if (r.error) setError(r.error); else changed(); });

  return (
    <div id="workmen-comp" className="scroll-mt-24 space-y-3">
      <p className="text-sm text-muted">
        Some workers can be on one policy and some on another. Add each certificate; the workers named on it are linked to it automatically.
        {policies.length > 0 && workers > 0 && <> <span className="text-primary">{covered} of {workers}</span> workers are linked to a policy.</>}
      </p>

      {policies.length > 0 && (
        <ul className="divide-y divide-default overflow-hidden rounded-[var(--radius-card)] border border-default bg-surface">
          {policies.map((p) => {
            const st = status(p.expiryDate);
            return (
              <li key={p.id}>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
                <a href={`/api/attachments/${p.id}`} target="_blank" rel="noreferrer" className="flex min-w-0 flex-1 items-center gap-2 text-sm font-medium text-primary hover:underline">
                  <FileText className="h-4 w-4 shrink-0 text-muted" aria-hidden />
                  <span className="truncate">{p.filename}</span>
                </a>
                <button type="button" onClick={() => toggle(p.id)} aria-expanded={openIds.has(p.id)} className="inline-flex items-center gap-1 text-xs font-medium text-[var(--brand-primary)] hover:underline">
                  {p.covered} {p.covered === 1 ? "worker" : "workers"} · who&rsquo;s on it
                  <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", openIds.has(p.id) && "rotate-180")} aria-hidden />
                </button>
                <span className={cn("text-xs font-medium", st.cls)}>{st.text}</span>
                {canEdit && (
                  <>
                    <input
                      type="date"
                      aria-label={`Expiry date of ${p.filename}`}
                      defaultValue={dayOf(p.expiryDate)}
                      onBlur={(e) => { if (e.target.value !== dayOf(p.expiryDate)) run(() => setWorkmenCompExpiryAction(supplierId, p.id, e.target.value || null)); }}
                      className="h-8 rounded-[var(--radius-control)] border border-default bg-surface px-2 text-xs"
                    />
                    <button
                      type="button"
                      aria-label={`Delete ${p.filename}`}
                      onClick={() => { if (confirm(`Delete this policy? The ${p.covered} workers linked to it will no longer be recorded as covered.`)) run(() => deleteWorkmenCompAction(supplierId, p.id)); }}
                      className="rounded-md p-1.5 text-muted hover:bg-surface-hover hover:text-error"
                    >
                      <Trash2 className="h-4 w-4" aria-hidden />
                    </button>
                  </>
                )}
              </div>
              {openIds.has(p.id) && <WorkmenCompWorkers supplierId={supplierId} attachmentId={p.id} filename={p.filename} canEdit={canEdit} onChanged={changed} />}
              </li>
            );
          })}
        </ul>
      )}

      {canEdit && (
        <div
          onDragOver={(e) => { e.preventDefault(); setOver(true); }}
          onDragLeave={() => setOver(false)}
          onDrop={(e) => { e.preventDefault(); setOver(false); void addFiles([...e.dataTransfer.files]); }}
          className={cn("flex flex-col items-center gap-2 rounded-[var(--radius-card)] border border-dashed px-4 py-6 text-center", over ? "border-brand bg-brand-soft" : "border-default")}
        >
          <Upload className="h-5 w-5 text-muted" aria-hidden />
          <p className="text-sm text-secondary">Drop one or several certificates here</p>
          <input ref={input} type="file" multiple accept="application/pdf,image/*" className="sr-only" aria-label="Choose workmen compensation certificates" onChange={(e) => { void addFiles([...(e.target.files ?? [])]); e.target.value = ""; }} />
          <Button type="button" variant="secondary" size="sm" disabled={busy} onClick={() => input.current?.click()}>
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : <Plus className="h-3.5 w-3.5" aria-hidden />}
            {policies.length > 0 ? "Add policies" : "Add policy"}
          </Button>
        </div>
      )}

      {progress.length > 0 && (
        <ul className="space-y-1 text-xs" aria-live="polite">
          {progress.map((r, i) => (
            <li key={i} className={cn("flex gap-2", r.state === "failed" ? "text-error" : r.state === "done" ? "text-secondary" : "text-muted")}>
              <span className="w-14 shrink-0">{r.state === "working" ? "Reading…" : r.state === "waiting" ? "Waiting" : r.state === "done" ? "Added" : "Failed"}</span>
              <span className="min-w-0 truncate">{r.name}{r.note ? ` — ${r.note}` : ""}</span>
            </li>
          ))}
        </ul>
      )}
      {error && <p role="alert" className="text-sm text-error">{error}</p>}
    </div>
  );
}
