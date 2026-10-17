"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { FileText, Loader2, Plus, Trash2, Upload } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";
import { deleteWorkmenCompAction, linkWorkmenCompCoverageAction, setWorkmenCompExpiryAction, uploadWorkmenCompAction } from "../actions";

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
export function WorkmenCompSection({ supplierId, policies, workers, canEdit }: { supplierId: string; policies: WcPolicy[]; workers: number; canEdit: boolean }) {
  const router = useRouter();
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
    const rows: Progress[] = files.map((f) => ({ name: f.name, state: "waiting" }));
    setProgress(rows);
    const set = (i: number, patch: Partial<Progress>) => setProgress((cur) => cur.map((r, j) => (j === i ? { ...r, ...patch } : r)));
    for (const [i, file] of files.entries()) {
      set(i, { state: "working" });
      try {
        // The certificate's own expiry date and the names it insures, each read from the file (best effort).
        let expiry = "";
        let names: string[] = [];
        const meta = new FormData();
        meta.append("file", file);
        const [c, e] = await Promise.all([
          fetch("/api/documents/extract-company", { method: "POST", body: meta }).then((r) => (r.ok ? r.json() : null)).catch(() => null),
          fetch("/api/documents/extract-employees", { method: "POST", body: meta }).then((r) => (r.ok ? r.json() : null)).catch(() => null),
        ]);
        expiry = /^\d{4}-\d{2}-\d{2}$/.test(c?.documentExpiry ?? "") ? c.documentExpiry : "";
        names = ((e?.employees ?? []) as { name: string | null }[]).map((x) => x.name ?? "").filter(Boolean);
        const form = new FormData();
        form.append("supplierId", supplierId);
        form.append("file", file);
        if (expiry) form.append("expiryDate", expiry);
        const up = await uploadWorkmenCompAction(form);
        if (!up.id) { set(i, { state: "failed", note: up.error ?? "Could not upload." }); continue; }
        const link = names.length > 0 ? await linkWorkmenCompCoverageAction(supplierId, names, up.id) : { linked: 0, unmatched: [] as string[] };
        const parts = [expiry ? `expires ${expiry}` : "no expiry date found", names.length > 0 ? `${link.linked} of ${names.length} named workers linked` : "no names found on it"];
        if (link.unmatched.length > 0) parts.push(`${link.unmatched.length} not on this supplier's roster`);
        set(i, { state: "done", note: parts.join(" · ") });
      } catch {
        set(i, { state: "failed", note: "Could not read or upload this file." });
      }
    }
    setBusy(false);
    start(() => router.refresh());
  }

  const run = (fn: () => Promise<{ error?: string }>) => start(async () => { const r = await fn(); if (r.error) setError(r.error); else router.refresh(); });

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
              <li key={p.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
                <a href={`/api/attachments/${p.id}`} target="_blank" rel="noreferrer" className="flex min-w-0 flex-1 items-center gap-2 text-sm font-medium text-primary hover:underline">
                  <FileText className="h-4 w-4 shrink-0 text-muted" aria-hidden />
                  <span className="truncate">{p.filename}</span>
                </a>
                <span className="text-xs text-muted">{p.covered} {p.covered === 1 ? "worker" : "workers"}</span>
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
