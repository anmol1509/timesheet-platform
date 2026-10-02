"use client";

import { useState } from "react";
import { Check, Sparkles, UserX } from "lucide-react";
import { cn } from "@/lib/cn";
import type { PlacementIssue, PlacementRow, WorkerChoice } from "@/lib/importer/types";

const KIND_TEXT: Record<PlacementIssue["kind"], string> = {
  several: "More than one worker has this name.",
  close: "No worker has exactly this name, but these look close.",
  unknown: "No worker on record looks like this name.",
};

/** Worker names in a camp file that couldn't be matched on their own: pick the right person, or skip. */
export function WorkerMatchPanel({ issues, applied, busy, onApply }: {
  issues: PlacementIssue[];
  applied: Record<string, WorkerChoice>;
  busy: boolean;
  onApply: (next: Record<string, WorkerChoice>) => void;
}) {
  const [draft, setDraft] = useState<Record<string, string>>(() =>
    Object.fromEntries(issues.flatMap((i) => (applied[i.key] ? [[i.key, applied[i.key].action === "skip" ? "skip" : (applied[i.key] as { employeeId: string }).employeeId]] : []))),
  );
  const suggested = issues.filter((i) => i.ai?.id && i.ai.confidence !== "low");
  const ready = issues.every((i) => draft[i.key]);
  const toChoices = (d: Record<string, string>): Record<string, WorkerChoice> => ({
    ...applied,
    ...Object.fromEntries(Object.entries(d).map(([k, v]) => [k, v === "skip" ? ({ action: "skip" } as const) : ({ action: "use", employeeId: v } as const)])),
  });

  return (
    <div className="card space-y-3 border-[var(--warning-border)] p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-primary">Please confirm these workers &middot; {issues.length}</p>
          <p className="mt-0.5 text-xs text-muted">The names below couldn&rsquo;t be matched with certainty. Nobody is placed on a guess: choose who is meant, or skip.</p>
        </div>
        {suggested.length > 0 && (
          <button type="button" className="btn btn-secondary btn-sm flex gap-1.5" onClick={() => setDraft((d) => ({ ...d, ...Object.fromEntries(suggested.filter((i) => !d[i.key]).map((i) => [i.key, i.ai!.id!])) }))}>
            <Sparkles className="h-3.5 w-3.5" aria-hidden /> Use all {suggested.length} suggestion{suggested.length === 1 ? "" : "s"}
          </button>
        )}
      </div>
      <ul className="divide-y divide-[var(--border)] rounded-lg border border-default">
        {issues.map((i) => (
          <li key={i.key} className="space-y-2 px-3 py-3">
            <p className="text-sm text-primary">
              <span className="font-medium">&ldquo;{i.fileName}&rdquo;</span>
              <span className="text-muted"> &mdash; {i.camp} / room {i.room}{i.rows.length > 1 ? `, ${i.rows.length} rows` : `, row ${i.rows[0]}`}</span>
            </p>
            <p className="text-xs text-muted">{KIND_TEXT[i.kind]}</p>
            <div className="space-y-1.5" role="radiogroup" aria-label={`Who is ${i.fileName}?`}>
              {i.candidates.map((c) => {
                const on = draft[i.key] === c.id;
                const pick = i.ai?.id === c.id;
                return (
                  <button key={c.id} type="button" role="radio" aria-checked={on} onClick={() => setDraft((d) => ({ ...d, [i.key]: c.id }))} className={cn("flex w-full items-start gap-3 rounded-lg border px-3 py-2 text-left transition", on ? "border-[var(--brand-primary)] bg-brand-soft" : "border-default hover:bg-surface-hover")}>
                    <span className={cn("mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border", on ? "border-[var(--brand-primary)] bg-[var(--brand-primary)] text-white" : "border-strong")}>{on && <Check className="h-3 w-3" aria-hidden />}</span>
                    <span className="min-w-0 flex-1 text-sm">
                      <span className="font-medium text-primary">{c.name}</span>
                      <span className="ml-2 text-xs text-muted">{c.code}{c.trade ? ` · ${c.trade}` : ""}{c.supplier ? ` · ${c.supplier}` : ""}</span>
                      {c.score < 1 && <span className="ml-2 text-xs text-muted">{Math.round(c.score * 100)}% alike</span>}
                      {c.housed && <span className="mt-0.5 block text-xs text-[var(--warning)]">Already in {c.housed}, so they can&rsquo;t be placed again from here.</span>}
                      {pick && i.ai && (
                        <span className="mt-1 flex items-start gap-1 text-xs text-[var(--brand-primary)]">
                          <Sparkles className="mt-0.5 h-3 w-3 shrink-0" aria-hidden /> Suggested ({i.ai.confidence} confidence){i.ai.reason ? `: ${i.ai.reason}` : ""}
                        </span>
                      )}
                    </span>
                  </button>
                );
              })}
              <button type="button" role="radio" aria-checked={draft[i.key] === "skip"} onClick={() => setDraft((d) => ({ ...d, [i.key]: "skip" }))} className={cn("flex w-full items-center gap-3 rounded-lg border px-3 py-2 text-left text-sm transition", draft[i.key] === "skip" ? "border-[var(--brand-primary)] bg-brand-soft" : "border-default hover:bg-surface-hover")}>
                <UserX className="h-4 w-4 shrink-0 text-muted" aria-hidden /> Skip this worker (don&rsquo;t place anyone)
              </button>
            </div>
            {i.ai && !i.ai.id && i.ai.reason && <p className="text-xs text-muted"><Sparkles className="mr-1 inline h-3 w-3" aria-hidden />None clearly fits: {i.ai.reason}</p>}
          </li>
        ))}
      </ul>
      <div className="flex items-center justify-end gap-3">
        {!ready && <span className="text-xs text-muted">Choose an option for each name.</span>}
        <button type="button" disabled={busy || !ready} className="btn btn-primary" onClick={() => onApply(toChoices(draft))}>
          {busy ? "Updating…" : "Apply choices"}
        </button>
      </div>
    </div>
  );
}

const STATUS: Record<PlacementRow["status"], { label: string; cls: string }> = {
  placed: { label: "Will be placed", cls: "bg-[var(--success-soft)] text-[var(--success)]" },
  decide: { label: "Needs your choice", cls: "bg-[var(--warning-soft)] text-[var(--warning)]" },
  skipped: { label: "Skipped", cls: "bg-surface-sunken text-secondary" },
  blocked: { label: "Can't be placed", cls: "bg-[var(--error-soft)] text-[var(--error)]" },
};

/** Who goes where, one line per worker in the file. */
export function PlacementTable({ rows }: { rows: PlacementRow[] }) {
  if (rows.length === 0) return null;
  return (
    <div className="card overflow-hidden">
      <p className="px-4 pt-3 text-sm font-semibold text-primary">Worker placements &middot; {rows.length}</p>
      <div className="max-h-96 overflow-auto">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-surface text-left text-xs font-medium uppercase tracking-wide text-muted">
            <tr><th className="px-4 py-2">Row</th><th className="px-3 py-2">In the file</th><th className="px-3 py-2">Matched worker</th><th className="px-3 py-2">Camp / room / bed</th><th className="px-3 py-2">Result</th></tr>
          </thead>
          <tbody className="divide-y divide-[var(--border)]">
            {rows.map((r, i) => (
              <tr key={`${r.row}-${i}`}>
                <td className="px-4 py-2 tabular text-muted">{r.row}</td>
                <td className="px-3 py-2 text-secondary">{r.fileName}</td>
                <td className="px-3 py-2">{r.worker ? <><span className="font-medium text-primary">{r.worker.name}</span> <span className="text-xs text-muted">{r.worker.code}{r.worker.trade ? ` · ${r.worker.trade}` : ""}</span></> : <span className="text-subtle">—</span>}</td>
                <td className="px-3 py-2 text-secondary">{r.camp} / {r.room}{r.bed ? ` / ${r.bed}` : ""}</td>
                <td className="px-3 py-2"><span className={cn("rounded-full px-2 py-0.5 text-xs font-medium", STATUS[r.status].cls)}>{STATUS[r.status].label}</span>{r.note && <span className="ml-2 text-xs text-muted">{r.note}</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
