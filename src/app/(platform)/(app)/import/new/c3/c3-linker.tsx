"use client";

import { useState, useTransition } from "react";
import { applyC3Action, previewC3Action, type C3Row } from "./actions";

const LABEL: Record<C3Row["state"], string> = { exact: "Matched", pick: "Several with this name", near: "Did you mean?", none: "Not found" };

export function C3Linker() {
  const [rows, setRows] = useState<C3Row[] | null>(null);
  const [choice, setChoice] = useState<Record<number, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function read(fd: FormData) {
    setError(null); setDone(null);
    start(async () => {
      const res = await previewC3Action(fd);
      if (res.error || !res.rows) { setError(res.error ?? "Couldn't read the file."); setRows(null); return; }
      setRows(res.rows);
      setChoice(Object.fromEntries(res.rows.filter((r) => r.chosen).map((r) => [r.row, r.chosen as string])));
    });
  }

  function save() {
    if (!rows) return;
    const links = rows.filter((r) => choice[r.row]).map((r) => ({ employeeId: choice[r.row], c3Id: r.c3Id }));
    setError(null);
    start(async () => {
      const res = await applyC3Action(links);
      if (res.error) { setError(res.error); return; }
      setDone(`${res.saved} worker${res.saved === 1 ? "" : "s"} linked${res.replaced ? `, ${res.replaced} had a different C3 ID that was replaced` : ""}.`);
      setRows(null);
    });
  }

  const picked = rows ? rows.filter((r) => choice[r.row]).length : 0;

  return (
    <div className="space-y-4">
      <form action={read} className="card flex flex-wrap items-end gap-3 p-4">
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-muted">Sheet (.xls, .xlsx or .csv) with a name column and a C3 ID column</span>
          <input type="file" name="file" accept=".xls,.xlsx,.csv" className="input" required />
        </label>
        <button type="submit" className="btn btn-primary" disabled={pending}>{pending ? "Reading…" : "Read sheet"}</button>
      </form>
      {error && <p role="alert" className="text-sm text-[var(--error)]">{error}</p>}
      {done && <p role="status" className="rounded-lg border border-default bg-surface-subtle px-4 py-3 text-sm text-primary">{done}</p>}
      {rows && (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="border-b border-default bg-surface-subtle text-left text-xs font-medium uppercase tracking-wide text-muted">
              <tr><th className="px-4 py-3">Name in sheet</th><th className="px-4 py-3">C3 ID</th><th className="px-4 py-3">Link to worker</th></tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {rows.map((r) => (
                <tr key={r.row}>
                  <td className="px-4 py-3 font-medium text-primary">{r.name}</td>
                  <td className="tabular px-4 py-3 text-secondary">{r.c3Id}</td>
                  <td className="px-4 py-3">
                    {r.candidates.length === 0 ? <span className="text-[var(--warning)]">{LABEL.none}</span> : (
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs text-muted">{LABEL[r.state]}</span>
                        <select
                          className="input py-1 text-sm"
                          value={choice[r.row] ?? ""}
                          onChange={(e) => setChoice((c) => { const n = { ...c }; if (e.target.value) n[r.row] = e.target.value; else delete n[r.row]; return n; })}
                        >
                          <option value="">Skip</option>
                          {r.candidates.map((p) => (
                            <option key={p.id} value={p.id}>{p.name} · {p.code}{p.company ? ` · ${p.company}` : ""}{p.c3Id ? ` · has C3 ${p.c3Id}` : ""}</option>
                          ))}
                        </select>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="flex items-center gap-3 border-t border-default px-4 py-3">
            <button type="button" className="btn btn-primary" disabled={pending || picked === 0} onClick={save}>{pending ? "Saving…" : `Save ${picked} link${picked === 1 ? "" : "s"}`}</button>
            <span className="text-xs text-muted">{rows.length - picked} left as skipped. Workers with a different C3 ID already will have it replaced.</span>
          </div>
        </div>
      )}
    </div>
  );
}
