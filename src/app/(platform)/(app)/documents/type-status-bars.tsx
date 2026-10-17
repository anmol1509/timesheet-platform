"use client";

import { cn } from "@/lib/cn";

export type TypeStatusRow = { type: string; label: string; valid: number; expiring: number; expired: number; noExpiry: number };
type Tab = "valid" | "expiring" | "expired" | "no_expiry";

const SEGMENTS: { key: Tab; field: keyof Omit<TypeStatusRow, "type" | "label">; label: string; bar: string; dot: string }[] = [
  { key: "valid", field: "valid", label: "Valid", bar: "bg-[var(--success)]", dot: "bg-[var(--success)]" },
  { key: "expiring", field: "expiring", label: "Expiring soon", bar: "bg-[var(--warning)]", dot: "bg-[var(--warning)]" },
  { key: "expired", field: "expired", label: "Expired", bar: "bg-[var(--error)]", dot: "bg-[var(--error)]" },
  { key: "no_expiry", field: "noExpiry", label: "No expiry", bar: "bg-[var(--border-strong)]", dot: "bg-[var(--border-strong)]" },
];

/** Asks the document list below to show one type and/or status, and brings it into view. */
export function filterDocuments(detail: { type: string; tab: Tab | "all" }) {
  window.dispatchEvent(new CustomEvent("documents:filter", { detail }));
}

/**
 * One bar per document type, split by status in the status colours, worst types first. A segment filters the list to
 * those documents; the type name filters it to that type.
 */
export function TypeStatusBars({ rows }: { rows: TypeStatusRow[] }) {
  const total = (r: TypeStatusRow) => r.valid + r.expiring + r.expired + r.noExpiry;
  const max = Math.max(1, ...rows.map(total));
  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted" aria-hidden>
        {SEGMENTS.map((s) => <span key={s.key} className="inline-flex items-center gap-1.5"><i className={cn("inline-block h-2 w-2 rounded-[3px]", s.dot)} />{s.label}</span>)}
        <span className="ml-auto">{rows.reduce((n, r) => n + total(r), 0)} documents · worst types first</span>
      </div>
      <ul className="space-y-2">
        {rows.map((r) => {
          const t = total(r);
          return (
            <li key={r.type} className="grid grid-cols-[7.5rem_1fr_6.5rem] items-center gap-3 sm:grid-cols-[9.5rem_1fr_8.5rem]">
              <button type="button" onClick={() => filterDocuments({ type: r.type, tab: "all" })} className="truncate text-left text-sm text-secondary hover:text-primary hover:underline" title={`Show ${r.label}`}>{r.label}</button>
              <div className="min-w-0">
                <div className="flex h-4 overflow-hidden rounded-md bg-surface-sunken" style={{ width: `${Math.max(6, (t / max) * 100)}%`, minWidth: "2.5rem" }} role="group" aria-label={`${r.label} by status`}>
                  {SEGMENTS.map((s) => r[s.field] > 0 && (
                    <button key={s.key} type="button" onClick={() => filterDocuments({ type: r.type, tab: s.key })} title={`${r.label}: ${r[s.field]} ${s.label.toLowerCase()}`} aria-label={`${r.label}: ${r[s.field]} ${s.label.toLowerCase()}`} className={cn("h-full transition hover:brightness-90 focus-visible:brightness-90", s.bar)} style={{ flex: r[s.field] }} />
                  ))}
                </div>
              </div>
              <span className="tabular flex justify-end gap-2.5 text-[12.5px] text-muted">
                <b className="font-semibold text-primary">{t}</b>
                {r.expired > 0 ? <button type="button" onClick={() => filterDocuments({ type: r.type, tab: "expired" })} className="font-semibold text-[var(--error)] hover:underline">{r.expired} expired</button> : r.expiring > 0 ? <button type="button" onClick={() => filterDocuments({ type: r.type, tab: "expiring" })} className="font-semibold text-[var(--warning)] hover:underline">{r.expiring} expiring</button> : null}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
