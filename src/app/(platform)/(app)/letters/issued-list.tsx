"use client";

import { useState } from "react";

export type IssuedRow = { key: string; kind: "Letter" | "NOC"; ref: string; who: string; whoSub: string; title: string; at: string; by: string; href: string; /** Wording changed for this one letter after it was drawn from the template. */ edited?: boolean };

/** Everything issued, newest first, with a filter for letters or NOCs and a search. */
export function IssuedList({ rows }: { rows: IssuedRow[] }) {
  const [kind, setKind] = useState<"" | "Letter" | "NOC">("");
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();
  const shown = rows.filter((r) => (!kind || r.kind === kind) && (!q || [r.ref, r.who, r.whoSub, r.title].some((x) => x.toLowerCase().includes(q))));
  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="mr-2 text-base font-semibold text-primary">Recently issued</h2>
        <div className="flex gap-1.5" role="group" aria-label="Type">
          {([["", "All"], ["Letter", "Letters"], ["NOC", "NOC"]] as const).map(([k, l]) => (
            <button key={k} type="button" aria-pressed={kind === k} onClick={() => setKind(k)} className={`rounded-full border px-3 py-1 text-xs font-medium ${kind === k ? "border-brand bg-brand-soft text-brand" : "border-default text-secondary hover:bg-surface-hover"}`}>{l}</button>
          ))}
        </div>
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search name or reference" aria-label="Search issued letters" className="input ml-auto h-9 w-60 text-sm" />
      </div>
      {shown.length === 0 ? (
        <div className="card p-8 text-center text-sm text-muted">{rows.length === 0 ? "Nothing issued yet. The first letter you issue appears here." : "No letters match."}</div>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[42rem] text-sm">
            <thead className="border-b border-default bg-surface-subtle text-left text-xs font-medium uppercase tracking-wide text-muted">
              <tr><th className="px-4 py-3">Ref</th><th className="px-4 py-3">For</th><th className="px-4 py-3">Letter</th><th className="px-4 py-3">Issued</th><th className="px-4 py-3" /></tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {shown.map((h) => (
                <tr key={h.key}>
                  <td className="whitespace-nowrap px-4 py-3 font-semibold text-primary">{h.ref}</td>
                  <td className="px-4 py-3"><p className="text-primary">{h.who}</p><p className="text-xs text-muted">{h.whoSub}</p></td>
                  <td className="px-4 py-3 text-secondary"><span className={`mr-2 rounded-md px-1.5 py-0.5 text-[11px] font-medium ${h.kind === "NOC" ? "bg-[var(--warning-soft)] text-[var(--warning)]" : "bg-surface-sunken text-secondary"}`}>{h.kind}</span>{h.title}{h.edited && <span className="ml-2 rounded-md bg-brand-soft px-1.5 py-0.5 text-[11px] font-medium text-brand">Edited</span>}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-secondary">{h.at}<p className="text-xs text-muted">by {h.by}</p></td>
                  <td className="px-4 py-3 text-right"><a href={h.href} target="_blank" rel="noreferrer" className="btn btn-secondary">Download</a></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
