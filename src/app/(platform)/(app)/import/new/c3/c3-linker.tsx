"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { cn } from "@/lib/cn";
import { applyC3Action, inspectC3Action, previewC3Action, undoC3Action, type C3Change, type C3Inspect, type C3Row } from "./actions";

import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/Alert";
type Step = "upload" | "map" | "review" | "done";
const STEPS: { key: Step; label: string }[] = [
  { key: "upload", label: "Upload" },
  { key: "map", label: "Match columns" },
  { key: "review", label: "Review" },
  { key: "done", label: "Import" },
];
const LABEL: Record<C3Row["state"], string> = { exact: "Matched", pick: "Several with this name", near: "Did you mean?", mismatch: "ID and name disagree", none: "Not found" };
type Filter = "all" | "matched" | "attention" | "none";

/** Link C3 IDs to workers: upload a sheet, confirm its columns (worker name, employee ID, C3 ID), review the matches, import. */
export function C3Linker() {
  const [step, setStep] = useState<Step>("upload");
  const [file, setFile] = useState<File | null>(null);
  const [info, setInfo] = useState<C3Inspect | null>(null);
  const [cols, setCols] = useState({ name: -1, code: -1, c3: -1 });
  const [rows, setRows] = useState<C3Row[] | null>(null);
  const [choice, setChoice] = useState<Record<number, string>>({});
  const [filter, setFilter] = useState<Filter>("all");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ saved: number; replaced: number; unchanged: number; changes: C3Change[] } | null>(null);
  const [undone, setUndone] = useState<{ restored: number; kept: number } | null>(null);
  const [pending, start] = useTransition();

  const idx = STEPS.findIndex((s) => s.key === step);
  const reachable = (k: Step) => !pending && (k === "upload" || (k === "map" && !!info && step !== "done") || (k === "review" && !!rows && step !== "done"));

  function inspect() {
    if (!file) { setError("Choose a file first."); return; }
    setError(null);
    const fd = new FormData();
    fd.set("file", file);
    start(async () => {
      const res = await inspectC3Action(fd);
      if (res.error || !res.headers) { setError(res.error ?? "Couldn't read the file."); return; }
      setInfo(res);
      setCols(res.suggest ?? { name: -1, code: -1, c3: -1 });
      setRows(null);
      setStep("map");
    });
  }

  function review() {
    if (!file || !info) return;
    setError(null);
    const fd = new FormData();
    fd.set("file", file);
    fd.set("headerRow", String(info.headerRow ?? 1));
    fd.set("nameCol", String(cols.name));
    fd.set("codeCol", String(cols.code));
    fd.set("c3Col", String(cols.c3));
    start(async () => {
      const res = await previewC3Action(fd);
      if (res.error || !res.rows) { setError(res.error ?? "Couldn't read the file."); return; }
      setRows(res.rows);
      setChoice(Object.fromEntries(res.rows.filter((r) => r.chosen).map((r) => [r.row, r.chosen as string])));
      setFilter("all");
      setStep("review");
    });
  }

  const links = useMemo(() => (rows ?? []).filter((r) => choice[r.row]).map((r) => ({ employeeId: choice[r.row], c3Id: r.c3Id })), [rows, choice]);

  function save() {
    setError(null);
    start(async () => {
      const res = await applyC3Action(links);
      if (res.error) { setError(res.error); return; }
      setResult({ saved: res.saved ?? 0, replaced: res.replaced ?? 0, unchanged: res.unchanged ?? 0, changes: res.changes ?? [] });
      setUndone(null);
      setStep("done");
    });
  }

  function undo() {
    if (!result) return;
    start(async () => {
      const res = await undoC3Action(result.changes);
      if (res.error) { setError(res.error); return; }
      setUndone({ restored: res.restored ?? 0, kept: res.kept ?? 0 });
    });
  }

  function again() {
    setStep("upload"); setFile(null); setInfo(null); setRows(null); setChoice({}); setResult(null); setUndone(null); setError(null);
  }

  const stats = useMemo(() => {
    const r = rows ?? [];
    const matched = r.filter((x) => x.state === "exact");
    return {
      byId: matched.filter((x) => x.via === "id").length,
      byName: matched.filter((x) => x.via === "name").length,
      attention: r.filter((x) => x.state === "pick" || x.state === "near" || x.state === "mismatch").length,
      none: r.filter((x) => x.state === "none").length,
      same: r.filter((x) => x.chosen && x.candidates[0]?.c3Id === x.c3Id && x.state === "exact").length,
    };
  }, [rows]);

  // The same C3 ID given to two workers is almost always a mistake in the sheet.
  const duplicates = useMemo(() => {
    const seen = new Map<string, Set<string>>();
    for (const l of links) seen.set(l.c3Id, (seen.get(l.c3Id) ?? new Set()).add(l.employeeId));
    return [...seen.entries()].filter(([, s]) => s.size > 1).map(([id]) => id);
  }, [links]);

  const shown = (rows ?? []).filter((r) => filter === "all" || (filter === "matched" && r.state === "exact") || (filter === "attention" && (r.state === "pick" || r.state === "near" || r.state === "mismatch")) || (filter === "none" && r.state === "none"));

  return (
    <div className="space-y-6">
      <ol className="flex flex-wrap items-center gap-2 text-xs">
        {STEPS.map((s, i) => {
          const go = reachable(s.key) && s.key !== step;
          const tone = i < idx || (go && i > idx)
            ? "border-[var(--success-border)] bg-[var(--success-soft)] text-[var(--success)]"
            : i === idx ? "border-[var(--brand-primary-border)] bg-brand-soft font-medium text-[var(--brand-primary)]" : "border-default text-muted";
          return (
            <li key={s.key}>
              <button type="button" disabled={!go} onClick={() => setStep(s.key)} aria-current={i === idx ? "step" : undefined} className={cn("flex items-center gap-2 rounded-full border px-3 py-1.5 transition", tone, go ? "cursor-pointer hover:shadow-sm" : "cursor-default")}>
                <span className="tabular font-semibold">{i < idx || (go && i > idx) ? "✓" : i + 1}</span>
                {s.label}
              </button>
            </li>
          );
        })}
      </ol>

      {error && <Alert>{error}</Alert>}

      {step === "upload" && (
        <section className="card space-y-4 p-5">
          <div>
            <h2 className="text-sm font-semibold text-primary">Upload your sheet</h2>
            <p className="mt-1 text-sm text-secondary">An Excel or CSV file with each worker&apos;s C3 ID, and either their name, their employee ID, or both. The employee ID is the surest way to find the right worker.</p>
          </div>
          <input type="file" accept=".xls,.xlsx,.csv" className="input" onChange={(e) => { setFile(e.target.files?.[0] ?? null); setError(null); }} aria-label="C3 sheet" />
          <div className="flex items-center gap-3">
            <Button size="btn" type="button" disabled={pending || !file} onClick={inspect} loading={pending}>Continue</Button>
            <span className="text-xs text-muted">Nothing is saved until the last step.</span>
          </div>
        </section>
      )}

      {step === "map" && info?.headers && (
        <section className="card space-y-5 p-5">
          <div>
            <h2 className="text-sm font-semibold text-primary">Match your columns</h2>
            <p className="mt-1 text-sm text-secondary">{file?.name}: {info.rowCount} rows, headings on row {info.headerRow}. We guessed which column is which. Change any that are wrong.</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            {([
              ["c3", "C3 ID", "Required", true],
              ["code", "Employee ID", "Their code in your system, e.g. TP103", false],
              ["name", "Worker name", "Used when there is no employee ID, and to double-check it", false],
            ] as const).map(([key, label, hint, required]) => (
              <label key={key} className="block text-xs font-medium text-muted">
                <span className="text-sm font-semibold text-primary">{label}{required ? " *" : ""}</span>
                <select className="input mt-1 w-full text-sm" value={cols[key]} onChange={(e) => setCols((c) => ({ ...c, [key]: Number(e.target.value) }))}>
                  <option value={-1}>{required ? "Choose a column" : "Not in this file"}</option>
                  {info.headers!.map((h, i) => <option key={i} value={i}>{h}</option>)}
                </select>
                <span className="mt-1 block font-normal">{hint}</span>
              </label>
            ))}
          </div>
          {info.sample && info.sample.length > 0 && (
            <div className="overflow-x-auto rounded-lg border border-default">
              <table className="w-full text-xs">
                <thead className="bg-surface-subtle text-left font-medium text-muted"><tr>{info.headers.map((h, i) => <th key={i} className={cn("px-3 py-2", (i === cols.c3 || i === cols.code || i === cols.name) && "text-[var(--brand-primary)]")}>{h}</th>)}</tr></thead>
                <tbody className="divide-y divide-[var(--border)]">{info.sample.map((r, n) => <tr key={n}>{info.headers!.map((_, i) => <td key={i} className="px-3 py-1.5 text-secondary">{r[i] ?? ""}</td>)}</tr>)}</tbody>
              </table>
            </div>
          )}
          <div className="flex items-center gap-3">
            <button type="button" className="btn btn-secondary" onClick={() => setStep("upload")}>Back</button>
            <Button size="btn" type="button" disabled={pending || cols.c3 < 0 || (cols.name < 0 && cols.code < 0)} onClick={review} loading={pending}>Match workers</Button>
            {(cols.c3 < 0 || (cols.name < 0 && cols.code < 0)) && <span className="text-xs text-muted">Choose the C3 ID column and the name or employee ID column.</span>}
          </div>
        </section>
      )}

      {step === "review" && rows && (
        <section className="space-y-4">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
            {[
              ["Matched by employee ID", stats.byId, "success"],
              ["Matched by name", stats.byName, "success"],
              ["Need your choice", stats.attention, stats.attention > 0 ? "info" : "neutral"],
              ["Not found", stats.none, stats.none > 0 ? "warn" : "neutral"],
              ["Already have this C3 ID", stats.same, "neutral"],
            ].map(([label, n, tone]) => (
              <div key={label as string} className="card p-3"><p className="text-xs text-muted">{label}</p><p className={cn("tabular text-2xl font-bold", tone === "success" ? "text-[var(--success)]" : tone === "warn" ? "text-[var(--warning)]" : tone === "info" ? "text-[var(--brand-primary)]" : "text-primary")}>{n as number}</p></div>
            ))}
          </div>
          {duplicates.length > 0 && <Alert tone="warning">The same C3 ID is going to more than one worker: {duplicates.slice(0, 4).join(", ")}{duplicates.length > 4 ? "…" : ""}. Check those rows before importing.</Alert>}
          <div className="flex flex-wrap gap-2 text-xs">
            {([["all", "All"], ["matched", "Matched"], ["attention", "Need your choice"], ["none", "Not found"]] as const).map(([k, label]) => (
              <button key={k} type="button" onClick={() => setFilter(k)} className={cn("rounded-full border px-3 py-1", filter === k ? "border-[var(--brand-primary-border)] bg-brand-soft font-medium text-[var(--brand-primary)]" : "border-default text-secondary")}>{label}</button>
            ))}
          </div>
          <div className="card overflow-hidden">
            <table className="w-full text-sm">
              <thead className="border-b border-default bg-surface-subtle text-left text-xs font-medium tracking-wide text-muted uppercase">
                <tr><th className="px-4 py-3">Name in sheet</th><th className="px-4 py-3">Employee ID</th><th className="px-4 py-3">C3 ID</th><th className="px-4 py-3">Link to worker</th></tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {shown.map((r) => (
                  <tr key={r.row}>
                    <td className="px-4 py-3 font-medium text-primary">{r.name || <span className="text-muted">No name</span>}</td>
                    <td className="tabular px-4 py-3 text-secondary">{r.code || <span className="text-muted">None</span>}</td>
                    <td className="tabular px-4 py-3 text-secondary">{r.c3Id}</td>
                    <td className="px-4 py-3">
                      {r.candidates.length === 0 ? <span className="text-[var(--warning)]">{LABEL.none}</span> : (
                        <div className="flex flex-wrap items-center gap-2">
                          <span className={cn("text-xs", r.state === "mismatch" ? "text-[var(--warning)]" : "text-muted")}>{LABEL[r.state]}{r.state === "exact" && r.via === "id" ? " by ID" : ""}</span>
                          <select className="input py-1 text-sm" value={choice[r.row] ?? ""} onChange={(e) => setChoice((c) => { const n = { ...c }; if (e.target.value) n[r.row] = e.target.value; else delete n[r.row]; return n; })}>
                            <option value="">Skip</option>
                            {r.candidates.map((p) => <option key={p.id} value={p.id}>{p.name} · {p.code}{p.company ? ` · ${p.company}` : ""}{p.c3Id ? ` · has C3 ${p.c3Id}` : ""}</option>)}
                          </select>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
                {shown.length === 0 && <tr><td colSpan={4} className="px-4 py-6 text-center text-sm text-muted">Nothing in this group.</td></tr>}
              </tbody>
            </table>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button type="button" className="btn btn-secondary" onClick={() => setStep("map")}>Back</button>
            <Button size="btn" type="button" disabled={pending || links.length === 0} onClick={save} loading={pending}>{`Import ${links.length} link${links.length === 1 ? "" : "s"}`}</Button>
            <span className="text-xs text-muted">{rows.length - links.length} left as skipped. A worker who has a different C3 ID will have it replaced; you can undo this afterwards.</span>
          </div>
        </section>
      )}

      {step === "done" && result && (
        <section className="space-y-4">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {[["Workers linked", result.saved, "success"], ["Replaced an older C3 ID", result.replaced, "info"], ["Already had it", result.unchanged, "neutral"], ["Skipped", (rows?.length ?? 0) - links.length, "neutral"]].map(([label, n, tone]) => (
              <div key={label as string} className="card p-3"><p className="text-xs text-muted">{label}</p><p className={cn("tabular text-2xl font-bold", tone === "success" ? "text-[var(--success)]" : tone === "info" ? "text-[var(--brand-primary)]" : "text-primary")}>{n as number}</p></div>
            ))}
          </div>
          {undone && <p role="status" className="rounded-lg border border-default bg-surface-subtle px-4 py-3 text-sm text-primary">Undone: {undone.restored} worker{undone.restored === 1 ? "" : "s"} put back{undone.kept ? `, ${undone.kept} left as they are because they were changed since` : ""}.</p>}
          <div className="flex flex-wrap items-center gap-3">
            <Link href="/employees" className="btn btn-primary">Go to employees</Link>
            <button type="button" className="btn btn-secondary" onClick={again}>Import another file</button>
            {result.saved > 0 && !undone && <Button variant="secondary" size="btn" type="button" disabled={pending} onClick={undo} loading={pending}>Undo this import</Button>}
          </div>
        </section>
      )}
    </div>
  );
}
