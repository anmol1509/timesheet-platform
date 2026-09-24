"use client";

import { useState, useTransition } from "react";
import { Check, Paperclip, X } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/Dialog";
import { Badge } from "@/components/Badge";
import { approveChangeAction, approveWorkerAction, rejectChangeAction, rejectWorkerAction } from "./actions";

type State = { error: string | null; ok?: boolean };
export type WorkerRow = { id: string; supplier: string; name: string; trade: string; submittedAt: string; details: [string, string][]; files: { id: string; docType: string; filename: string }[] };
export type ChangeRow = { id: string; kind: string; supplier: string; requestedAt: string; fields: { label: string; current: string; requested: string }[] };
type Recent = { key: string; text: string; status: string; note: string | null; at: string | null };

export function RequestsBoard({ workers, changes, recent, canDecide }: { workers: WorkerRow[]; changes: ChangeRow[]; recent: Recent[]; canDecide: boolean }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState<{ kind: "worker" | "change"; id: string; label: string } | null>(null);
  const [note, setNote] = useState("");

  const run = (fn: (fd: FormData) => Promise<State>, fields: Record<string, string>, after?: () => void) =>
    start(async () => {
      setError(null);
      const fd = new FormData();
      for (const [k, v] of Object.entries(fields)) fd.set(k, v);
      const r = await fn(fd);
      if (r.error) setError(r.error); else after?.();
    });

  return (
    <div className="space-y-5">
      {error && <p role="alert" className="text-sm text-[var(--error)]">{error}</p>}

      <section className="card overflow-hidden">
        <div className="flex items-center justify-between border-b border-default px-5 py-3"><h2 className="text-sm font-semibold text-primary">Workers awaiting approval</h2><span className="text-xs text-subtle">{workers.length}</span></div>
        {workers.length === 0 ? <p className="px-5 py-6 text-sm text-muted">No workers waiting.</p> : (
          <ul className="divide-y divide-[var(--border)]">
            {workers.map((w) => (
              <li key={w.id} className="px-5 py-4 text-sm">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div><p className="font-medium text-primary">{w.name} <span className="font-normal text-muted">· {w.trade}</span></p><p className="text-xs text-muted">{w.supplier} · sent {w.submittedAt}</p></div>
                  {canDecide && (
                    <div className="flex gap-1.5">
                      <button type="button" className="btn btn-primary" disabled={pending} onClick={() => run(approveWorkerAction, { id: w.id })}><Check className="h-4 w-4" aria-hidden /> Approve &amp; create employee</button>
                      <button type="button" className="btn btn-secondary" disabled={pending} onClick={() => { setNote(""); setRejecting({ kind: "worker", id: w.id, label: w.name }); }}><X className="h-4 w-4" aria-hidden /> Reject</button>
                    </div>
                  )}
                </div>
                <dl className="mt-2 grid gap-x-6 gap-y-1 text-xs sm:grid-cols-3">{w.details.map(([k, v]) => <div key={k}><dt className="text-muted">{k}</dt><dd className="text-secondary">{v}</dd></div>)}</dl>
                {w.files.length > 0 && <p className="mt-2 flex flex-wrap gap-3 text-xs">{w.files.map((f) => <a key={f.id} href={`/api/attachments/${f.id}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[var(--brand-primary)] hover:underline"><Paperclip className="h-3 w-3" aria-hidden />{f.docType.replace(/_/g, " ").toLowerCase()} · {f.filename}</a>)}</p>}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="card overflow-hidden">
        <div className="flex items-center justify-between border-b border-default px-5 py-3"><h2 className="text-sm font-semibold text-primary">Detail changes awaiting approval</h2><span className="text-xs text-subtle">{changes.length}</span></div>
        {changes.length === 0 ? <p className="px-5 py-6 text-sm text-muted">No changes waiting.</p> : (
          <ul className="divide-y divide-[var(--border)]">
            {changes.map((c) => (
              <li key={c.id} className="px-5 py-4 text-sm">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div><p className="font-medium text-primary">{c.supplier} <span className="font-normal text-muted">· {c.kind === "BANK" ? "bank details" : "contact details"}</span></p><p className="text-xs text-muted">Requested {c.requestedAt}</p></div>
                  {canDecide && (
                    <div className="flex gap-1.5">
                      <button type="button" className="btn btn-primary" disabled={pending} onClick={() => run(approveChangeAction, { id: c.id })}><Check className="h-4 w-4" aria-hidden /> Approve</button>
                      <button type="button" className="btn btn-secondary" disabled={pending} onClick={() => { setNote(""); setRejecting({ kind: "change", id: c.id, label: c.supplier }); }}><X className="h-4 w-4" aria-hidden /> Reject</button>
                    </div>
                  )}
                </div>
                {c.kind === "BANK" && <p className="mt-2 rounded-control border border-[var(--warning-border)] bg-[var(--warning-soft)] px-3 py-2 text-xs text-secondary">Bank details decide where payments go. Confirm this with the supplier on a number you already had before approving.</p>}
                <table className="mt-2 w-full text-xs"><thead className="text-left text-muted"><tr><th className="py-1 pr-3 font-medium">Field</th><th className="py-1 pr-3 font-medium">Now</th><th className="py-1 font-medium">Requested</th></tr></thead>
                  <tbody>{c.fields.map((f) => <tr key={f.label} className="border-t border-default"><td className="py-1.5 pr-3 text-muted">{f.label}</td><td className="py-1.5 pr-3 text-secondary">{f.current || "—"}</td><td className="py-1.5 font-medium text-primary">{f.requested}</td></tr>)}</tbody></table>
              </li>
            ))}
          </ul>
        )}
      </section>

      {recent.length > 0 && (
        <section className="card p-5">
          <h2 className="mb-2 text-sm font-semibold text-primary">Recently decided</h2>
          <ul className="divide-y divide-[var(--border)] text-sm">
            {recent.map((r) => (
              <li key={r.key} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <span className="text-secondary">{r.text}{r.note ? <span className="text-xs text-muted"> — {r.note}</span> : null}</span>
                <span className="flex items-center gap-2"><span className="text-xs text-subtle">{r.at}</span><Badge color={r.status === "APPROVED" ? "green" : "red"} dot>{r.status === "APPROVED" ? "Approved" : "Rejected"}</Badge></span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <Dialog open={rejecting !== null} onOpenChange={(o) => !o && setRejecting(null)}>
        {rejecting && (
          <DialogContent title="Reject this request?" description={rejecting.label}>
            <label className="mt-4 block"><span className="mb-1 block text-xs font-medium text-muted">Reason (the supplier will see this)</span><input value={note} onChange={(e) => setNote(e.target.value)} className="input w-full" /></label>
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" className="btn btn-secondary" onClick={() => setRejecting(null)}>Back</button>
              <button type="button" className="btn btn-primary" disabled={pending} onClick={() => run(rejecting.kind === "worker" ? rejectWorkerAction : rejectChangeAction, { id: rejecting.id, note }, () => setRejecting(null))}>Reject</button>
            </div>
          </DialogContent>
        )}
      </Dialog>
    </div>
  );
}
