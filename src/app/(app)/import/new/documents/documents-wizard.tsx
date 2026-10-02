"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import JSZip from "jszip";
import { AlertTriangle, CheckCircle2, FileText, FolderUp, Loader2, Sparkles, UploadCloud } from "lucide-react";
import { Select } from "@/components/ui/Select";
import { cn } from "@/lib/cn";
import { MAX_BATCH_BYTES, MAX_BATCH_FILES } from "@/lib/importer/documentLimits";
import { MIME_BY_EXT, extOf } from "@/lib/importer/documentMatch";
import { UndoImportButton } from "../../undo-button";

type Opt = { value: string; label: string };
type Cand = { kind: "EMPLOYEE" | "SUPPLIER"; id: string; name: string; sub: string; score: number };
type Owner = { key: string; text: string; fileCount: number; ai?: { id: string | null; confidence: string; reason: string }; match: { status: "matched"; kind: "EMPLOYEE" | "SUPPLIER"; id: string; name: string; how: string } | { status: "several" | "close" | "unknown"; candidates: Cand[] } };
type PlanFile = { index: number; path: string; name: string; ownerKey: string | null; type: string; status: "ok" | "skip"; reason?: string };
type Plan = { owners: Owner[]; files: PlanFile[]; employeeTypes: Opt[]; supplierTypes: Opt[]; pickList: { employees: { id: string; label: string }[]; suppliers: { id: string; label: string }[] } };
type Entry = { index: number; path: string; blob: Blob; size: number };
type Pick = { kind: "EMPLOYEE" | "SUPPLIER"; id: string; name: string } | "skip";
type FileEdit = { type?: string; expiry?: string; skip?: boolean; owner?: Pick; note?: string };
type Result = { name: string; status: string; message?: string };

async function post<T>(url: string, init: RequestInit): Promise<T> {
  let last = "Something went wrong.";
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch(url, init);
      const body = await res.json().catch(() => null);
      if (res.ok && body) return body as T;
      if (body?.error && ![502, 503, 504].includes(res.status)) throw new Error(body.error);
      last = body?.error ?? "The server didn't answer properly.";
    } catch (e) {
      if (e instanceof Error && !/failed to fetch|network|load failed/i.test(e.message) && e.message !== last) throw e;
      last = "Your connection dropped.";
    }
    await new Promise((r) => setTimeout(r, 700 * attempt));
  }
  throw new Error(last);
}

/** Every file the person gave us, with zips opened up and folder structure kept. */
async function collect(list: File[]): Promise<Entry[]> {
  const out: Entry[] = [];
  const add = (path: string, blob: Blob) => out.push({ index: out.length, path, blob, size: blob.size });
  for (const f of list) {
    if (/\.zip$/i.test(f.name)) {
      const zip = await JSZip.loadAsync(f);
      for (const entry of Object.values(zip.files)) {
        if (entry.dir) continue;
        add(entry.name, await entry.async("blob"));
      }
    } else {
      add((f as File & { webkitRelativePath?: string }).webkitRelativePath || f.name, f);
    }
  }
  return out;
}

export function DocumentsWizard() {
  const [step, setStep] = useState<"pick" | "review" | "uploading" | "done">("pick");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [plan, setPlan] = useState<Plan | null>(null);
  const [owners, setOwners] = useState<Record<string, Pick>>({});
  const [edits, setEdits] = useState<Record<number, FileEdit>>({});
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [outcome, setOutcome] = useState<{ batchId: string; created: number; results: Result[] } | null>(null);
  const [reading, setReading] = useState<number | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const dirRef = useRef<HTMLInputElement>(null);

  async function begin(list: File[]) {
    if (list.length === 0) return;
    setBusy(true); setError(null);
    try {
      const all = await collect(list);
      if (all.length === 0) throw new Error("Nothing to upload in that selection.");
      const res = await post<Plan>("/api/import/documents/plan", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ files: all.map((e) => ({ index: e.index, path: e.path, size: e.size })) }) });
      const initial: Record<string, Pick> = {};
      for (const o of res.owners) if (o.match.status === "matched") initial[o.key] = { kind: o.match.kind, id: o.match.id, name: o.match.name };
      setEntries(all); setPlan(res); setOwners(initial); setEdits({}); setStep("review");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not read those files.");
    } finally { setBusy(false); }
  }

  const ownerOf = (f: PlanFile): Pick | undefined => edits[f.index]?.owner ?? (f.ownerKey ? owners[f.ownerKey] : undefined);
  const typesFor = (kind?: "EMPLOYEE" | "SUPPLIER"): Opt[] => (kind === "SUPPLIER" ? plan?.supplierTypes : plan?.employeeTypes) ?? [];
  const typeOf = (f: PlanFile, o?: Pick) => {
    const t = edits[f.index]?.type ?? f.type;
    const kind = o && o !== "skip" ? o.kind : undefined;
    return typesFor(kind).some((x) => x.value === t) ? t : "OTHER";
  };
  const toSend = (plan?.files ?? []).filter((f) => f.status === "ok" && !edits[f.index]?.skip).map((f) => ({ f, o: ownerOf(f) })).filter((x): x is { f: PlanFile; o: Exclude<Pick, "skip"> } => !!x.o && x.o !== "skip");
  const okFiles = (plan?.files ?? []).filter((f) => f.status === "ok" && !edits[f.index]?.skip);

  async function readWithAi(f: PlanFile) {
    const entry = entries[f.index];
    setReading(f.index);
    try {
      const form = new FormData();
      form.set("file", new File([entry.blob], f.name));
      const r = await post<{ type: string; expiry: string | null; holder: string | null }>("/api/import/documents/read", { method: "POST", body: form });
      setEdits((p) => ({ ...p, [f.index]: { ...p[f.index], type: r.type, expiry: r.expiry ?? p[f.index]?.expiry, note: r.holder ? `AI read: issued to ${r.holder}` : "AI read this file" } }));
    } catch (e) {
      setEdits((p) => ({ ...p, [f.index]: { ...p[f.index], note: e instanceof Error ? e.message : "AI couldn't read this one." } }));
    } finally { setReading(null); }
  }

  async function upload() {
    setStep("uploading"); setError(null);
    const sendable = toSend.slice();
    setProgress({ done: 0, total: sendable.length });
    try {
      const label = `${sendable.length} document${sendable.length === 1 ? "" : "s"}`;
      const { batchId } = await post<{ batchId: string }>("/api/import/documents/start", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ label, total: sendable.length }) });
      const results: Result[] = [];
      let i = 0;
      while (i < sendable.length) {
        const group: typeof sendable = [];
        let bytes = 0;
        while (i < sendable.length && group.length < MAX_BATCH_FILES && (group.length === 0 || bytes + entries[sendable[i].f.index].size <= MAX_BATCH_BYTES)) {
          bytes += entries[sendable[i].f.index].size; group.push(sendable[i]); i++;
        }
        const form = new FormData();
        form.set("meta", JSON.stringify(group.map(({ f, o }) => ({ name: f.name, ownerKind: o.kind, ownerId: o.id, type: typeOf(f, o), expiry: edits[f.index]?.expiry || null }))));
        group.forEach(({ f }, k) => form.set(`file${k}`, new File([entries[f.index].blob], f.name)));
        try {
          const r = await post<{ results: Result[] }>(`/api/import/documents/${batchId}/upload`, { method: "POST", body: form });
          results.push(...r.results);
        } catch (e) {
          results.push(...group.map(({ f }) => ({ name: f.name, status: "failed", message: e instanceof Error ? e.message : "Could not be sent." })));
        }
        setProgress({ done: Math.min(i, sendable.length), total: sendable.length });
      }
      await post(`/api/import/documents/${batchId}/finish`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ rows: results }) });
      setOutcome({ batchId, created: results.filter((r) => r.status === "created").length, results });
      setStep("done");
    } catch (e) {
      setError(e instanceof Error ? e.message : "The upload stopped.");
      setStep("review");
    }
  }

  const pickOptions = (kind: "ANY" | "EMPLOYEE" | "SUPPLIER" = "ANY") => [
    ...(kind !== "SUPPLIER" ? (plan?.pickList.employees ?? []).map((e) => ({ value: `E:${e.id}`, label: e.label })) : []),
    ...(kind !== "EMPLOYEE" ? (plan?.pickList.suppliers ?? []).map((s) => ({ value: `S:${s.id}`, label: `${s.label} (supplier)` })) : []),
  ];
  const fromValue = (v: string): Pick => {
    const id = v.slice(2);
    return v.startsWith("E:") ? { kind: "EMPLOYEE", id, name: plan?.pickList.employees.find((e) => e.id === id)?.label ?? "" } : { kind: "SUPPLIER", id, name: plan?.pickList.suppliers.find((s) => s.id === id)?.label ?? "" };
  };
  const pickValue = (p?: Pick) => (p && p !== "skip" ? `${p.kind === "EMPLOYEE" ? "E" : "S"}:${p.id}` : "");

  if (step === "pick") {
    return (
      <div className="space-y-4">
        <div
          className="card flex flex-col items-center gap-3 border-dashed p-10 text-center"
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => { e.preventDefault(); void begin([...e.dataTransfer.files]); }}
        >
          <UploadCloud className="h-8 w-8 text-[var(--brand-primary)]" aria-hidden />
          <p className="text-sm font-semibold text-primary">Drop your documents here</p>
          <p className="max-w-xl text-xs text-muted">PDF or images, one file per document, named with the worker or supplier (<em>Ravi Kumar &ndash; Passport.pdf</em>, <em>AN-101 Emirates ID.jpg</em>) &mdash; or a ZIP or folder with one folder per person (<em>Ravi Kumar/passport.pdf</em>). Files up to 4&nbsp;MB.</p>
          <div className="flex flex-wrap justify-center gap-2">
            <button type="button" className="btn btn-primary flex gap-1.5" disabled={busy} onClick={() => fileRef.current?.click()}><FileText className="h-4 w-4" aria-hidden />Choose files or a ZIP</button>
            <button type="button" className="btn btn-secondary flex gap-1.5" disabled={busy} onClick={() => dirRef.current?.click()}><FolderUp className="h-4 w-4" aria-hidden />Choose a folder</button>
          </div>
          <input ref={fileRef} type="file" multiple accept=".zip,.pdf,.jpg,.jpeg,.png,.gif,.webp,.heic,.heif,.doc,.docx,.xls,.xlsx" className="hidden" onChange={(e) => void begin([...(e.target.files ?? [])])} />
          <input ref={dirRef} type="file" multiple className="hidden" onChange={(e) => void begin([...(e.target.files ?? [])].filter((f) => MIME_BY_EXT[extOf(f.name)]))} {...({ webkitdirectory: "" } as object)} />
          {busy && <p className="flex items-center gap-2 text-xs text-muted"><Loader2 className="h-4 w-4 animate-spin" aria-hidden />Reading file names&hellip;</p>}
        </div>
        {error && <p className="rounded-lg border border-[var(--error-border)] bg-[var(--error-soft)] px-4 py-3 text-sm text-[var(--error)]">{error}</p>}
      </div>
    );
  }

  if (step === "uploading") {
    const pct = progress.total ? Math.round((progress.done / progress.total) * 100) : 0;
    return (
      <div className="card space-y-3 p-6">
        <p className="flex items-center gap-2 text-sm font-semibold text-primary"><Loader2 className="h-4 w-4 animate-spin text-[var(--brand-primary)]" aria-hidden />Uploading documents&hellip;</p>
        <div className="h-2 overflow-hidden rounded-full bg-surface-sunken" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}><div className="h-full rounded-full bg-[var(--brand-primary)] transition-all" style={{ width: `${Math.max(pct, 4)}%` }} /></div>
        <p className="tabular text-xs text-muted">{progress.done} of {progress.total} &middot; keep this page open until it finishes.</p>
      </div>
    );
  }

  if (step === "done" && outcome) {
    const bad = outcome.results.filter((r) => r.status !== "created");
    return (
      <div className="space-y-4">
        <p className="flex items-center gap-2 text-sm font-semibold text-primary"><CheckCircle2 className="h-5 w-5 text-[var(--success)]" aria-hidden />Upload finished</p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Tile label="Documents filed" value={outcome.created} tone="success" />
          <Tile label="Already on file" value={outcome.results.filter((r) => r.status === "duplicate").length} />
          <Tile label="Failed" value={outcome.results.filter((r) => r.status === "failed").length} tone={outcome.results.some((r) => r.status === "failed") ? "error" : undefined} />
          <Tile label="Left out" value={(plan?.files ?? []).length - outcome.results.length} />
        </div>
        {bad.length > 0 && (
          <ul className="card divide-y divide-[var(--border)] text-sm">
            {bad.slice(0, 50).map((r, k) => <li key={k} className="flex justify-between gap-3 px-4 py-2"><span className="truncate text-primary">{r.name}</span><span className="shrink-0 text-xs text-muted">{r.message}</span></li>)}
          </ul>
        )}
        <div className="flex flex-wrap items-center gap-4 border-t border-default pt-4">
          <Link href="/import" className="btn btn-secondary">Back to Import data</Link>
          <button type="button" className="btn btn-secondary" onClick={() => { setStep("pick"); setPlan(null); setOutcome(null); }}>Upload more</button>
          <UndoImportButton batchId={outcome.batchId} />
        </div>
      </div>
    );
  }

  if (!plan) return null;
  const skipped = plan.files.filter((f) => f.status === "skip");
  const undecided = plan.owners.filter((o) => !owners[o.key]);
  const noOwner = plan.files.filter((f) => f.status === "ok" && !f.ownerKey && !edits[f.index]?.owner && !edits[f.index]?.skip);
  return (
    <div className="space-y-4">
      <div className="card flex flex-wrap items-center justify-between gap-3 p-4">
        <div>
          <p className="text-sm font-semibold text-primary">{plan.files.length} file{plan.files.length === 1 ? "" : "s"} read &middot; {toSend.length} ready to file</p>
          <p className="mt-0.5 text-xs text-muted">Check who each file belongs to and its type. Nothing is saved until you press Upload.</p>
        </div>
        {plan.owners.some((o) => !owners[o.key] && o.ai?.id) && (
          <button type="button" className="btn btn-secondary btn-sm flex gap-1.5" onClick={() => setOwners((p) => {
            const next = { ...p };
            for (const o of plan.owners) if (!next[o.key] && o.ai?.id && o.ai.confidence !== "low" && o.match.status !== "matched") { const c = o.match.candidates.find((x) => x.id === o.ai!.id); if (c) next[o.key] = { kind: c.kind, id: c.id, name: c.name }; }
            return next;
          })}><Sparkles className="h-3.5 w-3.5" aria-hidden />Use AI suggestions</button>
        )}
      </div>

      {plan.owners.map((o) => {
        const chosen = owners[o.key];
        const files = plan.files.filter((f) => f.ownerKey === o.key && f.status === "ok");
        return (
          <div key={o.key} className="card space-y-3 p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm text-primary"><span className="font-medium">&ldquo;{o.text}&rdquo;</span> <span className="text-muted">&middot; {files.length} file{files.length === 1 ? "" : "s"}</span></p>
                {chosen && chosen !== "skip" && <p className="mt-0.5 text-xs text-[var(--success)]">{chosen.kind === "SUPPLIER" ? "Supplier" : "Worker"}: {chosen.name}{o.match.status === "matched" && o.match.id === chosen.id ? ` (matched by ${o.match.how})` : ""}</p>}
                {chosen === "skip" && <p className="mt-0.5 text-xs text-muted">These files will be left out.</p>}
                {!chosen && <p className="mt-0.5 text-xs text-[var(--warning)]">{o.match.status === "unknown" ? "No worker or supplier by that name." : o.match.status === "several" ? "More than one has that name." : "No exact match; close ones below."}</p>}
              </div>
              <div className="flex w-80 max-w-full items-center gap-2">
                <div className="min-w-0 flex-1"><Select value={pickValue(chosen)} onChange={(v) => setOwners((p) => ({ ...p, [o.key]: fromValue(v) }))} placeholder="Choose worker or supplier…" searchPlaceholder="Search…" options={pickOptions()} /></div>
                <button type="button" className={cn("btn btn-sm", chosen === "skip" ? "btn-primary" : "btn-secondary")} onClick={() => setOwners((p) => { const n = { ...p }; if (n[o.key] === "skip") delete n[o.key]; else n[o.key] = "skip"; return n; })}>Skip</button>
              </div>
            </div>
            {o.match.status !== "matched" && !chosen && o.match.candidates.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {o.match.candidates.map((c) => (
                  <button key={c.kind + c.id} type="button" onClick={() => setOwners((p) => ({ ...p, [o.key]: { kind: c.kind, id: c.id, name: c.name } }))} className="rounded-lg border border-default px-3 py-1.5 text-left text-xs hover:bg-surface-hover">
                    <span className="font-medium text-primary">{c.name}</span> <span className="text-muted">{c.sub}{c.score < 1 ? ` · ${Math.round(c.score * 100)}% alike` : ""}</span>
                    {o.ai?.id === c.id && <span className="ml-2 inline-flex items-center gap-1 text-[var(--brand-primary)]"><Sparkles className="h-3 w-3" aria-hidden />Suggested</span>}
                  </button>
                ))}
              </div>
            )}
            <FileRows files={files} chosen={chosen} typeOf={typeOf} typesFor={typesFor} edits={edits} setEdits={setEdits} readWithAi={readWithAi} reading={reading} />
          </div>
        );
      })}

      {noOwner.length > 0 && (
        <div className="card space-y-2 p-4">
          <p className="text-sm font-semibold text-primary">Files with no name in them &middot; {noOwner.length}</p>
          <p className="text-xs text-muted">Choose who each belongs to, or skip it.</p>
          <ul className="divide-y divide-[var(--border)]">
            {noOwner.map((f) => (
              <li key={f.index} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <span className="truncate text-sm text-primary">{f.path}</span>
                <div className="flex w-80 max-w-full items-center gap-2">
                  <div className="min-w-0 flex-1"><Select value={pickValue(edits[f.index]?.owner)} onChange={(v) => setEdits((p) => ({ ...p, [f.index]: { ...p[f.index], owner: fromValue(v) } }))} placeholder="Choose…" options={pickOptions()} /></div>
                  <button type="button" className="btn btn-secondary btn-sm" onClick={() => setEdits((p) => ({ ...p, [f.index]: { ...p[f.index], skip: true } }))}>Skip</button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {skipped.length > 0 && (
        <details className="card p-4 text-sm">
          <summary className="cursor-pointer select-none font-medium text-primary">{skipped.length} file{skipped.length === 1 ? "" : "s"} can&rsquo;t be uploaded</summary>
          <ul className="mt-2 space-y-1 text-xs text-muted">{skipped.slice(0, 100).map((f) => <li key={f.index}><span className="text-primary">{f.path}</span> &mdash; {f.reason}</li>)}</ul>
        </details>
      )}

      {error && <p className="flex items-start gap-2 rounded-lg border border-[var(--error-border)] bg-[var(--error-soft)] px-4 py-3 text-sm text-[var(--error)]"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />{error}</p>}
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-default pt-4">
        <button type="button" className="btn btn-secondary" onClick={() => { setStep("pick"); setPlan(null); }}>Start again</button>
        {(undecided.length > 0 || noOwner.length > 0) && <p className="text-xs text-[var(--warning)]">{okFiles.length - toSend.length} file{okFiles.length - toSend.length === 1 ? "" : "s"} with no owner chosen will be left out.</p>}
        <button type="button" className="btn btn-primary" disabled={toSend.length === 0} onClick={() => void upload()}>Upload {toSend.length} document{toSend.length === 1 ? "" : "s"}</button>
      </div>
    </div>
  );
}

function Tile({ label, value, tone }: { label: string; value: number; tone?: "success" | "error" }) {
  return (
    <div className="card p-3">
      <p className={cn("tabular text-2xl font-semibold", tone === "success" ? "text-[var(--success)]" : tone === "error" ? "text-[var(--error)]" : "text-primary")}>{value}</p>
      <p className="text-xs text-muted">{label}</p>
    </div>
  );
}

function FileRows({ files, chosen, typeOf, typesFor, edits, setEdits, readWithAi, reading }: {
  files: PlanFile[];
  chosen?: Pick;
  typeOf: (f: PlanFile, o?: Pick) => string;
  typesFor: (k?: "EMPLOYEE" | "SUPPLIER") => Opt[];
  edits: Record<number, FileEdit>;
  setEdits: React.Dispatch<React.SetStateAction<Record<number, FileEdit>>>;
  readWithAi: (f: PlanFile) => void;
  reading: number | null;
}) {
  const kind = chosen && chosen !== "skip" ? chosen.kind : undefined;
  return (
    <ul className={cn("divide-y divide-[var(--border)] rounded-lg border border-default", chosen === "skip" && "opacity-50")}>
      {files.map((f) => {
        const e = edits[f.index] ?? {};
        const aiable = ["pdf", "jpg", "jpeg", "png", "gif", "webp"].includes(extOf(f.name));
        return (
          <li key={f.index} className={cn("flex flex-wrap items-center gap-3 px-3 py-2 text-sm", e.skip && "opacity-40")}>
            <span className="min-w-0 flex-1 truncate text-primary" title={f.path}>{f.name}{e.note && <span className="ml-2 text-xs text-muted">{e.note}</span>}</span>
            <div className="w-56"><Select value={typeOf(f, chosen)} onChange={(v) => setEdits((p) => ({ ...p, [f.index]: { ...p[f.index], type: v } }))} searchable={false} options={typesFor(kind)} /></div>
            <input type="date" value={e.expiry ?? ""} onChange={(ev) => setEdits((p) => ({ ...p, [f.index]: { ...p[f.index], expiry: ev.target.value } }))} className="input w-40 px-2 py-1.5 text-sm" aria-label={`Expiry date for ${f.name}`} title="Expiry date (optional)" />
            {aiable && <button type="button" className="btn btn-secondary btn-sm flex gap-1.5" disabled={reading !== null} onClick={() => readWithAi(f)} title="Sends this one document to the AI to find its type and expiry date">{reading === f.index ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : <Sparkles className="h-3.5 w-3.5" aria-hidden />}Read with AI</button>}
            <button type="button" className="text-xs text-muted hover:underline" onClick={() => setEdits((p) => ({ ...p, [f.index]: { ...p[f.index], skip: !p[f.index]?.skip } }))}>{e.skip ? "Include" : "Leave out"}</button>
          </li>
        );
      })}
    </ul>
  );
}
