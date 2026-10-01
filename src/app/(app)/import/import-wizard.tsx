"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { AlertTriangle, CheckCircle2, FileSpreadsheet, Loader2, Sparkles, Undo2, UploadCloud } from "lucide-react";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { ReportView, type TileSpec } from "@/components/import/report";
import { cn } from "@/lib/cn";
import { TARGETS } from "@/lib/importer/targets";
import type { Fix, Fixable, ImportKind } from "@/lib/importer/types";
import type { Analysis, BatchStatus, BatchSummary } from "@/lib/importer/wire";
import type { CopilotResult } from "@/lib/importer/copilot";

type Step = "upload" | "map" | "review" | "running" | "done";
const STEPS: { key: Step; label: string }[] = [
  { key: "upload", label: "Upload" },
  { key: "map", label: "Match columns" },
  { key: "review", label: "Review" },
  { key: "running", label: "Import" },
];
const LISTS: Record<ImportKind, { href: string; label: string }> = {
  SUPPLIERS: { href: "/suppliers", label: "Go to suppliers" },
  CLIENTS: { href: "/clients", label: "Go to clients" },
  WORKERS: { href: "/employees", label: "Go to employees" },
  TIMESHEETS: { href: "/companies", label: "Go to timesheets" },
};

function tilesFor(kind: ImportKind, c: Record<string, number>): TileSpec[] {
  if (kind === "TIMESHEETS") {
    return [
      { label: "New timesheet rows", value: c.created ?? 0, tone: "success" },
      { label: "Updated rows", value: c.updated ?? 0, tone: "info" },
      { label: "Suppliers added", value: c.suppliersCreated ?? 0, tone: "neutral", hint: `${c.subsidiariesLinked ?? 0} placed under a main supplier` },
      { label: "Clients added", value: c.clientsCreated ?? 0, tone: "neutral" },
      { label: "Attendance days", value: c.attendanceCreated ?? 0, tone: "success", hint: "recorded from the daily hours" },
      { label: "Failed", value: c.failed ?? 0, tone: (c.failed ?? 0) > 0 ? "error" : "neutral" },
    ];
  }
  return [
    { label: "Created", value: c.created ?? 0, tone: "success", hint: c.parentsCreated ? `+ ${c.parentsCreated} parents` : c.suppliersCreated ? `+ ${c.suppliersCreated} suppliers` : undefined },
    { label: "Updated", value: c.updated ?? 0, tone: "info" },
    { label: "Merged", value: c.merged ?? 0, tone: "neutral", hint: "repeated rows" },
    { label: "Failed", value: c.failed ?? 0, tone: (c.failed ?? 0) > 0 ? "error" : "neutral" },
  ];
}

async function call<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error ?? "Something went wrong.");
  return body as T;
}

export function ImportWizard({ kind }: { kind: ImportKind }) {
  const target = TARGETS[kind];
  const [step, setStep] = useState<Step>("upload");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [batchId, setBatchId] = useState<string | null>(null);
  const [filename, setFilename] = useState("");
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [columns, setColumns] = useState<Record<string, string>>({});
  const [overrides, setOverrides] = useState<Record<string, string>>({});
  /** The AI check's answer, and the company names the person agreed are ones already on file. */
  const [copilot, setCopilot] = useState<CopilotResult | null>(null);
  const [checking, setChecking] = useState(false);
  const [aliases, setAliases] = useState<Record<string, string>>({});
  /** Corrections typed in on the review screen (rates, hours, nationalities); sent with every preview and the final run. */
  const [fixes, setFixes] = useState<Fix[]>([]);
  const [summary, setSummary] = useState<BatchSummary | null>(null);
  /** The column choices the current preview was made with; the review is only reachable while they still match. */
  const [previewedKey, setPreviewedKey] = useState<string | null>(null);
  const [status, setStatus] = useState<BatchStatus | null>(null);
  const dropRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const wrap = useCallback(async (fn: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }, []);

  function upload(file: File) {
    void wrap(async () => {
      const form = new FormData();
      form.set("file", file);
      form.set("kind", kind);
      const res = await call<{ batchId: string; analysis: Analysis }>("/api/import", { method: "POST", body: form });
      setBatchId(res.batchId);
      setFilename(file.name);
      setSummary(null);
      setPreviewedKey(null);
      setOverrides({});
      setAliases({});
      setFixes([]);
      setCopilot(null);
      setAnalysis(res.analysis);
      if (res.analysis.kind !== "TIMESHEETS") setColumns(res.analysis.columns);
      setStep("map");
    });
  }

  async function runCopilot() {
    setChecking(true);
    setError(null);
    try {
      const res = await call<{ result: CopilotResult }>(`/api/import/${batchId}/copilot`, { method: "POST", body: JSON.stringify({ timesheetOverrides: overrides }), headers: { "content-type": "application/json" } });
      setCopilot(res.result);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setChecking(false);
    }
  }

  function reanalyse(body: object) {
    void wrap(async () => {
      const res = await call<{ analysis: Analysis }>(`/api/import/${batchId}/analyze`, { method: "POST", body: JSON.stringify(body), headers: { "content-type": "application/json" } });
      setAnalysis(res.analysis);
      if (res.analysis.kind !== "TIMESHEETS") setColumns(res.analysis.columns);
    });
  }

  function preview(fixList: Fix[] = fixes) {
    void wrap(async () => {
      const mapping =
        analysis?.kind === "TIMESHEETS"
          ? { columns: {}, timesheetOverrides: overrides, aliases, fixes: fixList }
          : { sheet: analysis?.sheet, headerRow: analysis?.headerRow, columns };
      const res = await call<{ summary: BatchSummary }>(`/api/import/${batchId}/preview`, { method: "POST", body: JSON.stringify(mapping), headers: { "content-type": "application/json" } });
      setSummary(res.summary);
      setPreviewedKey(keyFor(fixList));
      setStep("review");
    });
  }

  function start() {
    void wrap(async () => {
      await call(`/api/import/${batchId}/run`, { method: "POST" });
      setStep("running");
    });
  }

  // While it runs, ask how far along it is.
  useEffect(() => {
    if (step !== "running" || !batchId) return;
    let stop = false;
    const tick = async () => {
      try {
        const s = await call<BatchStatus>(`/api/import/${batchId}`);
        if (stop) return;
        setStatus(s);
        if (s.status === "DONE" || s.status === "FAILED") {
          setSummary(s.summary ?? summary);
          setStep("done");
          return;
        }
      } catch {
        /* a missed poll is fine; the next one will do */
      }
      if (!stop) setTimeout(tick, 1100);
    };
    void tick();
    return () => {
      stop = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, batchId]);

  function undo() {
    void wrap(async () => {
      await call(`/api/import/${batchId}/undo`, { method: "POST" });
      setStatus(await call<BatchStatus>(`/api/import/${batchId}`));
    });
  }

  const idx = step === "done" ? STEPS.length : STEPS.findIndex((s) => s.key === step);
  const keyFor = (fixList: Fix[]) => JSON.stringify({ s: analysis && analysis.kind !== "TIMESHEETS" ? analysis.sheet : null, c: columns, o: overrides, a: aliases, f: fixList });
  const mappingKey = keyFor(fixes);
  // Steps can be revisited freely until the import starts; Review only while its preview still matches the choices.
  const locked = step === "running" || step === "done";
  const reachable = (key: Step) =>
    !locked && (key === "upload" || (key === "map" && !!analysis) || (key === "review" && !!summary && previewedKey === mappingKey));

  return (
    <div className="space-y-6">
      {/* stepper */}
      <ol className="flex flex-wrap items-center gap-2 text-xs">
        {STEPS.map((s, i) => {
          const go = reachable(s.key) && s.key !== step;
          const tone = i < idx || (reachable(s.key) && s.key !== step && i > idx)
            ? "border-[var(--success-border)] bg-[var(--success-soft)] text-[var(--success)]"
            : i === idx
              ? "border-[var(--brand-primary-border)] bg-brand-soft font-medium text-[var(--brand-primary)]"
              : "border-default text-muted";
          return (
            <li key={s.key}>
              <button
                type="button"
                disabled={!go || busy}
                onClick={() => setStep(s.key)}
                aria-current={i === idx ? "step" : undefined}
                title={go ? `Go to ${s.label.toLowerCase()}` : undefined}
                className={cn("flex items-center gap-2 rounded-full border px-3 py-1.5 transition", tone, go && !busy ? "cursor-pointer hover:shadow-sm hover:brightness-95" : "cursor-default")}
              >
                <span className="tabular font-semibold">{i < idx || (go && i > idx) ? "✓" : i + 1}</span>
                {s.label}
              </button>
            </li>
          );
        })}
      </ol>

      {error && (
        <p className="flex items-start gap-2 rounded-lg border border-[var(--error-border)] bg-[var(--error-soft)] px-4 py-3 text-sm text-[var(--error)]">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          {error}
        </p>
      )}

      {/* Keyed on the step so each one eases in rather than swapping abruptly. */}
      <div key={step} className="step-enter space-y-6">
      {step === "upload" && analysis && (
        <div className="card flex flex-wrap items-center justify-between gap-3 p-4">
          <p className="flex items-center gap-2 text-sm text-primary">
            <FileSpreadsheet className="h-4 w-4 text-[var(--brand-primary)]" aria-hidden /> <span className="font-medium">{filename}</span>
            <span className="text-muted">is loaded. Choose a different file below, or keep it.</span>
          </p>
          <button type="button" className="btn btn-secondary" onClick={() => setStep("map")}>Keep this file</button>
        </div>
      )}

      {step === "upload" && (
        <div
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => { e.preventDefault(); setDragging(false); const f = e.dataTransfer.files?.[0]; if (f) upload(f); }}
          className={cn("card flex flex-col items-center justify-center gap-3 border-2 border-dashed px-6 py-14 text-center transition", dragging && "border-[var(--brand-primary)] bg-brand-soft")}
        >
          {busy ? <Loader2 className="h-8 w-8 animate-spin text-[var(--brand-primary)]" aria-hidden /> : <UploadCloud className="h-8 w-8 text-[var(--brand-primary)]" aria-hidden />}
          <p className="text-sm font-medium text-primary">{busy ? "Reading your file…" : `Drop your ${target.label.toLowerCase()} file here`}</p>
          <p className="max-w-md text-xs text-muted">
            {kind === "TIMESHEETS"
              ? "An Excel (.xlsx) timesheet with a tab per month. Suppliers, sponsors, clients, workers, hours and attendance are all read from it."
              : "An Excel (.xlsx) or CSV file with a header row. Your column names don't have to match ours — you'll confirm the matches next."}
          </p>
          {/* A real <label> around the input: the browser opens the picker itself, with no script click in between. */}
          <label className={cn("btn btn-primary cursor-pointer", busy && "pointer-events-none opacity-60")}>
            Choose a file
            <input ref={dropRef} type="file" disabled={busy} accept={kind === "TIMESHEETS" ? ".xlsx" : ".xlsx,.csv"} className="sr-only" onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f); e.target.value = ""; }} />
          </label>
          <a href={`/api/import/template/${kind.toLowerCase()}`} className="text-xs font-medium text-[var(--brand-primary)] hover:underline">
            Download a blank {target.label.toLowerCase()} template
          </a>
        </div>
      )}

      {step === "map" && analysis && (
        <div className="space-y-4">
          <div className="card flex flex-wrap items-center justify-between gap-3 p-4">
            <p className="flex items-center gap-2 text-sm font-medium text-primary">
              <FileSpreadsheet className="h-4 w-4 text-[var(--brand-primary)]" aria-hidden /> {filename}
            </p>
            {analysis.kind !== "TIMESHEETS" && analysis.sheets.length > 1 && (
              <label className="flex items-center gap-2 text-xs text-muted">
                Sheet
                <select className="input" value={analysis.sheet} disabled={busy} onChange={(e) => reanalyse({ sheet: e.target.value })}>
                  {analysis.sheets.map((s) => (
                    <option key={s.name} value={s.name}>{s.name} ({s.dataRows} rows)</option>
                  ))}
                </select>
              </label>
            )}
          </div>

          {analysis.kind !== "TIMESHEETS" ? (
            <MapColumns kind={analysis.kind} analysis={analysis} columns={columns} setColumns={setColumns} />
          ) : (
            <TimesheetSheets analysis={analysis} overrides={overrides} onPick={(field, header) => {
              const next = { ...overrides, [field]: header };
              setOverrides(next);
              reanalyse({ timesheetOverrides: next });
            }} />
          )}

          {analysis.kind === "TIMESHEETS" && (
            <CopilotPanel
              result={copilot}
              checking={checking}
              onRun={runCopilot}
              aliases={aliases}
              onAlias={(from, to) => setAliases((prev) => { const next = { ...prev }; if (to) next[from] = to; else delete next[from]; return next; })}
              onPick={(field, header) => {
                const next = { ...overrides, [field]: header };
                setOverrides(next);
                reanalyse({ timesheetOverrides: next });
              }}
              overrides={overrides}
            />
          )}

          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-muted">Nothing is saved yet. Next you&rsquo;ll see exactly what would happen.</p>
            <button type="button" onClick={() => preview()} disabled={busy || !canContinue(kind, analysis, columns)} className="btn btn-primary">
              {busy ? "Checking…" : "Check and preview"}
            </button>
          </div>
        </div>
      )}

      {step === "review" && summary && (
        <div className="space-y-4">
          <div className="card p-4">
            <p className="text-sm font-semibold text-primary">Here&rsquo;s what will happen</p>
            <p className="mt-1 text-xs text-muted">This is a dry run: nothing has been saved. After importing you can undo it for 30 days.</p>
          </div>
          {(summary.fixables?.length ?? 0) > 0 && (
            <FixPanel
              fixables={summary.fixables!}
              busy={busy}
              onApply={(entered) => {
                const key = (f: Fix) => `${f.type}|${f.id.toUpperCase()}|${f.month ?? ""}|${f.date ?? ""}`;
                const merged = new Map(fixes.map((f) => [key(f), f]));
                for (const f of entered) merged.set(key(f), f);
                const next = [...merged.values()];
                setFixes(next);
                preview(next);
              }}
            />
          )}
          <ReportView tiles={tilesFor(kind, summary.counts)} rows={summary.rows} notes={summary.notes} truncated={summary.truncated} />
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-default pt-4">
            <button type="button" className="btn btn-secondary" onClick={() => setStep("map")} disabled={busy}>Back to columns</button>
            <button type="button" className="btn btn-primary" onClick={start} disabled={busy || ((summary.counts.created ?? 0) + (summary.counts.updated ?? 0) === 0)}>
              Import {(summary.counts.created ?? 0) + (summary.counts.updated ?? 0)} {target.noun}{(summary.counts.created ?? 0) + (summary.counts.updated ?? 0) === 1 ? "" : "s"}
            </button>
          </div>
        </div>
      )}

      {step === "running" && (
        <div className="card space-y-3 p-6">
          <p className="flex items-center gap-2 text-sm font-semibold text-primary">
            <Loader2 className="h-4 w-4 animate-spin text-[var(--brand-primary)]" aria-hidden /> Importing…
          </p>
          <div className="h-2 overflow-hidden rounded-full bg-surface-sunken" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct(status)}>
            <div className="h-full rounded-full bg-[var(--brand-primary)] transition-all" style={{ width: `${Math.max(pct(status), 4)}%` }} />
          </div>
          <p className="tabular text-xs text-muted">
            {status && status.progressTotal > 0 ? `${status.progressDone} of ${status.progressTotal}` : "Starting…"} &middot; you can leave this page; the import carries on.
          </p>
        </div>
      )}

      {step === "done" && (status || summary) && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            {status?.status === "FAILED" ? <AlertTriangle className="h-5 w-5 text-[var(--error)]" aria-hidden /> : status?.status === "UNDONE" ? <Undo2 className="h-5 w-5 text-[var(--info)]" aria-hidden /> : <CheckCircle2 className="h-5 w-5 text-[var(--success)]" aria-hidden />}
            <p className="text-sm font-semibold text-primary">
              {status?.status === "FAILED" ? "The import stopped part-way" : status?.status === "UNDONE" ? "Import undone" : "Import finished"}
              <span className="ml-2 font-normal text-muted">{filename}</span>
            </p>
          </div>
          {status?.status === "FAILED" && (
            <p className="rounded-lg border border-[var(--error-border)] bg-[var(--error-soft)] px-4 py-3 text-sm text-[var(--error)]">
              {status.error ?? "Something went wrong."} What was saved before it stopped can be undone below.
            </p>
          )}
          {(status?.summary ?? summary) && (
            <ReportView tiles={tilesFor(kind, (status?.summary ?? summary)!.counts)} rows={(status?.summary ?? summary)!.rows} notes={(status?.summary ?? summary)!.notes} truncated={(status?.summary ?? summary)!.truncated} />
          )}
          {status?.summary?.undo && (
            <p className="text-sm text-secondary">Undone: {status.summary.undo.removed} records removed, {status.summary.undo.restored} restored{status.summary.undo.kept ? `, ${status.summary.undo.kept} kept because other records use them` : ""}.</p>
          )}
          <div className="flex flex-wrap items-center gap-2 border-t border-default pt-4">
            <Link href={LISTS[kind].href} className="btn btn-primary">{LISTS[kind].label}</Link>
            <Link href="/import" className="btn btn-secondary">Import something else</Link>
            {(status?.status === "DONE" || status?.status === "FAILED") && (
              <ConfirmDialog
                title="Undo this import?"
                description="Everything this import created is removed and everything it changed goes back as it was. Records that other data now depends on are kept and reported."
                confirmLabel="Yes, undo it"
                onConfirm={undo}
                trigger={(open) => (
                  <button type="button" onClick={open} disabled={busy} className="btn btn-secondary ml-auto inline-flex items-center gap-1.5">
                    <Undo2 className="h-4 w-4" aria-hidden /> Undo this import
                  </button>
                )}
              />
            )}
          </div>
          {status?.undoUntil && status.status === "DONE" && (
            <p className="text-xs text-muted">You can undo this until {new Date(status.undoUntil).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}.</p>
          )}
        </div>
      )}
      </div>
    </div>
  );
}

function pct(s: BatchStatus | null) {
  return s && s.progressTotal > 0 ? Math.round((s.progressDone / s.progressTotal) * 100) : 0;
}

function canContinue(kind: ImportKind, analysis: Analysis, columns: Record<string, string>) {
  if (analysis.kind === "TIMESHEETS") return analysis.sheets.some((s) => s.month && s.headerRow);
  return TARGETS[kind].fields.filter((f) => f.required).every((f) => !!columns[f.key]);
}

function MapColumns({ kind, analysis, columns, setColumns }: { kind: ImportKind; analysis: Extract<Analysis, { kind: Exclude<ImportKind, "TIMESHEETS"> }>; columns: Record<string, string>; setColumns: (c: Record<string, string>) => void }) {
  const fields = TARGETS[kind].fields;
  const sheet = analysis.sheets.find((s) => s.name === analysis.sheet);
  const headers = sheet?.headers ?? [];
  const conf = new Map(analysis.matches.map((m) => [m.header, m]));
  const used = new Set(Object.values(columns).filter(Boolean));
  const sample = (h: string) => {
    const i = headers.indexOf(h);
    return i < 0 ? [] : (sheet?.sample ?? []).map((r) => r[i]).filter(Boolean).slice(0, 3);
  };
  const missing = fields.filter((f) => f.required && !columns[f.key]);
  return (
    <div className="space-y-3">
      <div className="card overflow-hidden">
        <div className="border-b border-default bg-surface-subtle px-4 py-2.5 text-xs text-muted">
          Header found on row {analysis.headerRow} &middot; {sheet?.dataRows ?? 0} rows of data. Tell us which of your columns is which; we&rsquo;ve matched what we could. One column can fill more than one detail (for example the same name for both Supplier name and Full name).
        </div>
        <ul className="divide-y divide-[var(--border)]">
          {fields.map((f) => {
            const chosen = columns[f.key] ?? "";
            const m = chosen ? conf.get(chosen) : undefined;
            const auto = m?.field === f.key;
            return (
              <li key={f.key} className="grid grid-cols-1 items-center gap-2 px-4 py-3 sm:grid-cols-[minmax(150px,1fr)_minmax(200px,1.4fr)_1.4fr]">
                <p className="text-sm font-medium text-primary">
                  {f.label}
                  {f.required && <span className="text-[var(--error)]"> *</span>}
                </p>
                <div className="flex items-center gap-2">
                  <select className="input w-full" value={chosen} onChange={(e) => setColumns({ ...columns, [f.key]: e.target.value })} aria-label={`Column for ${f.label}`}>
                    <option value="">{f.required ? "Choose a column…" : "Not in my file"}</option>
                    {headers.map((h) => (
                      <option key={h} value={h}>{h}</option>
                    ))}
                  </select>
                  {chosen && (
                    <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium", auto && (m?.confidence ?? 0) >= 0.9 ? "bg-[var(--success-soft)] text-[var(--success)]" : auto ? "bg-[var(--warning-soft)] text-[var(--warning)]" : "bg-surface-sunken text-muted")}>
                      {auto ? ((m?.confidence ?? 0) >= 0.9 ? "Matched" : "Check") : "Chosen"}
                    </span>
                  )}
                </div>
                <p className="truncate text-xs text-muted">{chosen ? sample(chosen).join(" · ") || "—" : ""}</p>
              </li>
            );
          })}
        </ul>
      </div>
      {missing.length > 0 && <p className="text-xs text-[var(--error)]">Still needed: {missing.map((f) => f.label).join(", ")}.</p>}
      {headers.filter((h) => !used.has(h)).length > 0 && (
        <p className="text-xs text-muted">Not imported: {headers.filter((h) => !used.has(h)).slice(0, 12).join(", ")}{headers.filter((h) => !used.has(h)).length > 12 ? "…" : ""}</p>
      )}
    </div>
  );
}

/** Problems in the file that can be corrected here, before anything is imported. Typing a value and applying re-runs the preview, so a fixed problem disappears. */
function FixPanel({ fixables, busy, onApply }: { fixables: Fixable[]; busy: boolean; onApply: (fixes: Fix[]) => void }) {
  const [draft, setDraft] = useState<Record<string, string>>({});
  const idOf = (f: Fixable) => `${f.type}|${f.id}|${f.month ?? ""}|${f.date ?? ""}`;
  const groups: { type: Fixable["type"]; title: string; hint: string; placeholder: string }[] = [
    { type: "rate", title: "Rate is 0", hint: "Enter the hourly rate to bill for this worker.", placeholder: "Rate" },
    { type: "hours", title: "Unusual hours", hint: "Enter the hours worked that day (0 to leave the day empty).", placeholder: "Hours" },
    { type: "nationality", title: "Nationality is not a country", hint: "Enter the country, e.g. India.", placeholder: "Country" },
  ];
  const entered = fixables.filter((f) => (draft[idOf(f)] ?? "").trim() !== "");
  return (
    <div className="card space-y-4 p-4">
      <div>
        <p className="text-sm font-semibold text-primary">Fix before importing</p>
        <p className="mt-0.5 text-xs text-muted">Correct these here and press Apply &mdash; the preview is re-checked. Your original file isn&rsquo;t changed, and anything you leave is imported as it is.</p>
      </div>
      {groups.map((g) => {
        const rows = fixables.filter((f) => f.type === g.type);
        if (rows.length === 0) return null;
        return (
          <div key={g.type} className="space-y-2">
            <p className="text-xs font-semibold tracking-wide text-muted uppercase">{g.title} &middot; {rows.length}</p>
            <p className="text-xs text-muted">{g.hint}</p>
            <ul className="divide-y divide-[var(--border)] rounded-lg border border-default">
              {rows.map((f) => (
                <li key={idOf(f)} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm">
                  <span className="min-w-0 text-primary">
                    <span className="font-medium">{f.name}</span> <span className="text-subtle">{f.id}</span>
                    <span className="text-muted"> &mdash; {f.type === "hours" ? `${f.date}: ${f.current} hours` : f.type === "nationality" ? `“${f.current}”` : f.monthLabel}</span>
                  </span>
                  <input
                    value={draft[idOf(f)] ?? ""}
                    onChange={(e) => setDraft((prev) => ({ ...prev, [idOf(f)]: e.target.value }))}
                    placeholder={g.placeholder}
                    inputMode={g.type === "nationality" ? "text" : "decimal"}
                    aria-label={`${g.placeholder} for ${f.name}`}
                    className="input w-32 px-2 py-1.5"
                  />
                </li>
              ))}
            </ul>
          </div>
        );
      })}
      <div className="flex items-center justify-end gap-3">
        {entered.length > 0 && <span className="text-xs text-muted">{entered.length} to apply</span>}
        <button
          type="button"
          disabled={busy || entered.length === 0}
          onClick={() => {
            onApply(entered.map((f) => ({ type: f.type, id: f.id, month: f.month, date: f.date, value: (draft[idOf(f)] ?? "").trim() })));
            setDraft({});
          }}
          className="btn btn-primary"
        >
          {busy ? "Checking…" : "Apply and re-check"}
        </button>
      </div>
    </div>
  );
}

function CopilotPanel({ result, checking, onRun, aliases, onAlias, onPick, overrides }: {
  result: CopilotResult | null;
  checking: boolean;
  onRun: () => void;
  aliases: Record<string, string>;
  onAlias: (from: string, to: string | null) => void;
  onPick: (field: string, header: string) => void;
  overrides: Record<string, string>;
}) {
  const TONE = { high: "bg-[var(--error)]", medium: "bg-[var(--warning)]", low: "bg-[var(--info)]" } as const;
  return (
    <div className="card space-y-3 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="flex items-center gap-2 text-sm font-semibold text-primary">
            <Sparkles className="h-4 w-4 text-[var(--brand-primary)]" aria-hidden /> Check this file with AI
          </p>
          <p className="mt-0.5 text-xs text-muted">Looks for missing columns, clashing codes and company names you already have. It sends a summary of company, client and trade names — not hours or salaries — and changes nothing until you say so.</p>
        </div>
        <button type="button" onClick={onRun} disabled={checking} className="btn btn-secondary inline-flex items-center gap-1.5">
          {checking ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Sparkles className="h-4 w-4" aria-hidden />}
          {checking ? "Checking…" : result ? "Check again" : "Check with AI"}
        </button>
      </div>

      {result && (
        <div className="space-y-3 border-t border-default pt-3">
          <p className="text-sm text-secondary">{result.summary}</p>
          {!result.ai && <p className="text-xs text-muted">The AI part wasn&rsquo;t available just now, so only the built-in checks ran.</p>}

          {result.mappingSuggestions.map((m) => {
            const applied = overrides[m.field] === m.header;
            return (
              <div key={m.field} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-brand-soft px-3 py-2 text-sm">
                <p className="text-primary">
                  <span className="font-medium">{m.label}</span> looks like the column <span className="font-medium">&ldquo;{m.header}&rdquo;</span>
                  <span className="text-muted"> &mdash; {m.reason}</span>
                </p>
                <button type="button" disabled={applied} onClick={() => onPick(m.field, m.header)} className="btn btn-secondary btn-sm">{applied ? "Using it" : "Use this column"}</button>
              </div>
            );
          })}

          {result.nameMatches.map((n) => {
            const applied = aliases[n.from] === n.to;
            return (
              <div key={n.from} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-brand-soft px-3 py-2 text-sm">
                <p className="text-primary">
                  <span className="font-medium">&ldquo;{n.from}&rdquo;</span> looks like your existing {n.kind} <span className="font-medium">&ldquo;{n.to}&rdquo;</span>
                  <span className="text-muted"> &mdash; {n.reason}</span>
                </p>
                <button type="button" onClick={() => onAlias(n.from, applied ? null : n.to)} className="btn btn-secondary btn-sm">{applied ? "Undo" : "Treat as the same"}</button>
              </div>
            );
          })}

          {result.findings.length > 0 ? (
            <ul className="space-y-2">
              {result.findings.map((f, i) => (
                <li key={i} className="flex items-start gap-2.5 text-sm">
                  <span className={cn("mt-1.5 h-2 w-2 shrink-0 rounded-full", TONE[f.severity])} aria-hidden />
                  <span><span className="font-medium text-primary">{f.title}.</span> <span className="text-secondary">{f.detail}</span></span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="flex items-center gap-2 text-sm text-[var(--success)]"><CheckCircle2 className="h-4 w-4" aria-hidden /> Nothing to flag.</p>
          )}
        </div>
      )}
    </div>
  );
}

const TS_REQUIRED: { key: string; label: string }[] = [
  { key: "idNo", label: "Employee code" },
  { key: "name", label: "Worker name" },
  { key: "supplier", label: "Supplier" },
];
const TS_OPTIONAL: { key: string; label: string }[] = [
  { key: "sponsor", label: "Sponsor" },
  { key: "client", label: "Client" },
  { key: "project", label: "Project" },
  { key: "trade", label: "Trade" },
  { key: "rate", label: "Rate" },
  { key: "payRate", label: "Pay rate (per hour)" },
  { key: "nationality", label: "Nationality" },
];

function TimesheetSheets({ analysis, overrides, onPick }: { analysis: Extract<Analysis, { kind: "TIMESHEETS" }>; overrides: Record<string, string>; onPick: (field: string, header: string) => void }) {
  const months = analysis.sheets.filter((s) => s.month && s.headerRow);
  const skipped = analysis.sheets.filter((s) => !s.month || !s.headerRow);
  const allHeaders = [...new Set(months.flatMap((s) => s.headers))];
  return (
    <div className="space-y-3">
      <div className="card overflow-hidden">
        <div className="border-b border-default bg-surface-subtle px-4 py-2.5 text-xs text-muted">
          {months.length} month{months.length === 1 ? "" : "s"} found. Each tab is read on its own, so the columns can sit in different places.
        </div>
        <ul className="divide-y divide-[var(--border)]">
          {months.map((s) => (
            <li key={s.sheet} className="space-y-2 px-4 py-3">
              <p className="text-sm font-medium text-primary">
                {s.sheet} <span className="tabular ml-1 rounded-md bg-surface-sunken px-1.5 py-0.5 text-xs text-muted">{s.month}</span>
                <span className="ml-2 text-xs font-normal text-muted">{s.rows} rows</span>
              </p>
              <div className="flex flex-wrap gap-1.5">
                {TS_REQUIRED.map((f) => (
                  <span key={f.key} className={cn("rounded-full px-2 py-0.5 text-[11px] font-medium", s.detected[f.key] ? "bg-[var(--success-soft)] text-[var(--success)]" : "bg-[var(--error-soft)] text-[var(--error)]")}>
                    {f.label}: {s.detected[f.key] ?? "not found"}
                  </span>
                ))}
                {TS_OPTIONAL.filter((f) => s.detected[f.key]).map((f) => (
                  <span key={f.key} className="rounded-full bg-surface-sunken px-2 py-0.5 text-[11px] text-secondary">{f.label}: {s.detected[f.key]}</span>
                ))}
              </div>
            </li>
          ))}
        </ul>
      </div>
      {TS_REQUIRED.some((f) => months.some((s) => !s.detected[f.key])) && (
        <div className="card space-y-3 p-4">
          <p className="text-sm font-medium text-primary">Some columns weren&rsquo;t found &mdash; pick them</p>
          {TS_REQUIRED.filter((f) => months.some((s) => !s.detected[f.key])).map((f) => (
            <label key={f.key} className="flex flex-wrap items-center gap-3 text-sm">
              <span className="w-40 font-medium text-primary">{f.label}</span>
              <select className="input min-w-[220px]" value={overrides[f.key] ?? ""} onChange={(e) => onPick(f.key, e.target.value)}>
                <option value="">Choose a column…</option>
                {allHeaders.map((h) => (
                  <option key={h} value={h}>{h}</option>
                ))}
              </select>
            </label>
          ))}
        </div>
      )}
      {skipped.length > 0 && (
        <p className="text-xs text-muted">Skipped (not a month tab, or no EMPLOYEE NAME column): {skipped.map((s) => s.sheet).join(", ")}.</p>
      )}
    </div>
  );
}
