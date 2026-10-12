"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import JSZip from "jszip";
import { AlertTriangle, CheckCircle2, FileText, FolderUp, HardHat, Loader2, Sparkles, Truck, UploadCloud } from "lucide-react";
import { Select } from "@/components/ui/Select";
import { EmployeeAvatar } from "@/components/Avatar";
import type { SelectOption } from "@/components/ui/Select";
import { cn } from "@/lib/cn";
import { MAX_BATCH_BYTES, MAX_BATCH_FILES, MAX_BULK_FILE_BYTES } from "@/lib/importer/documentLimits";
import { MIME_BY_EXT, extOf } from "@/lib/importer/documentMatch";
import { groupPages, type Audience, type Confidence, type PageRead } from "@/lib/importer/documentRead";
import { cutPdf, imageToPage, pdfToPages, type PageImage } from "@/lib/pdfPages";
import { shrinkImage } from "@/lib/compressImage";
import { UndoImportButton } from "../../undo-button";

type Opt = { value: string; label: string; icon?: React.ReactNode };
type Cand = { kind: "EMPLOYEE" | "SUPPLIER"; id: string; name: string; sub: string; score: number };
type Match = { status: "matched"; kind: "EMPLOYEE" | "SUPPLIER"; id: string; name: string; how: string } | { status: "several" | "close" | "unknown"; candidates: Cand[] };
type Owner = { key: string; label: string; match: Match; ai?: { id: string | null; confidence: string; reason: string }; newWorker?: { name: string; passportNumber: string; emiratesId: string; trade: string } };
type PlanDoc = { docKey: string; index: number; fileName: string; type: string; expiry: string; confidence: Confidence; pages: number[]; ownerKey: string | null; via: string | null; conflict: boolean; status: "ok" | "skip"; reason?: string; readByAi: boolean };
type Plan = { audience: Audience; owners: Owner[]; docs: PlanDoc[]; types: Opt[]; pickList: { employees: { id: string; label: string; name: string; photo: boolean }[]; suppliers: { id: string; label: string }[] } };
type ReadDoc = { docKey: string; type: string; holder: string; idNumber: string; expiry: string; confidence: Confidence; pages: number[]; fields?: Record<string, string> };
type Source = { index: number; path: string; blob: Blob; size: number; isPdf: boolean; isImage: boolean; totalPages: number; thumbs: Map<number, string>; docs?: ReadDoc[]; note?: string };
type Pick = { kind: "EMPLOYEE" | "SUPPLIER"; id: string; name: string } | "skip" | "new";
type DocEdit = { type?: string; expiry?: string; skip?: boolean; owner?: Pick };
type Result = { name: string; status: string; message?: string; recordUpdated?: boolean };

const MAX_PAGES_PER_FILE = 120;
const MAX_PAGES_PER_RUN = 500;

async function post<T>(url: string, init: RequestInit): Promise<T> {
  let last = "Something went wrong.";
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch(url, init);
      const body = await res.json().catch(() => null);
      if (res.ok && body) return body as T;
      if (body?.error && ![502, 503, 504].includes(res.status)) throw Object.assign(new Error(body.error), { status: res.status });
      last = body?.error ?? "The server didn't answer properly.";
      if (res.status === 503) throw Object.assign(new Error(last), { status: 503 });
    } catch (e) {
      if (e instanceof Error && (e as Error & { status?: number }).status) throw e;
      if (e instanceof Error && !/failed to fetch|network|load failed/i.test(e.message) && e.message !== last) throw e;
      last = "Your connection dropped.";
    }
    await new Promise((r) => setTimeout(r, 700 * attempt));
  }
  throw new Error(last);
}

/** Every file the person gave us, with zips opened up and folder structure kept. */
async function collect(list: File[]): Promise<Source[]> {
  const out: Source[] = [];
  const add = (path: string, blob: Blob) => {
    const ext = extOf(path);
    out.push({ index: out.length, path, blob, size: blob.size, isPdf: ext === "pdf", isImage: ["jpg", "jpeg", "png", "gif", "webp"].includes(ext), totalPages: 0, thumbs: new Map() });
  };
  for (const f of list) {
    if (/\.zip$/i.test(f.name)) {
      const zip = await JSZip.loadAsync(f);
      for (const entry of Object.values(zip.files)) if (!entry.dir) add(entry.name, await entry.async("blob"));
    } else add((f as File & { webkitRelativePath?: string }).webkitRelativePath || f.name, f);
  }
  return out;
}

const baseName = (path: string) => (path.replace(/\\/g, "/").split("/").pop() ?? path).replace(/\.[a-z0-9]{2,5}$/i, "");

export function DocumentsWizard() {
  const [step, setStep] = useState<"audience" | "pick" | "reading" | "review" | "uploading" | "done">("audience");
  const [audience, setAudience] = useState<Audience>("EMPLOYEE");
  const [useAi, setUseAi] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [sources, setSources] = useState<Source[]>([]);
  const [plan, setPlan] = useState<Plan | null>(null);
  const [owners, setOwners] = useState<Record<string, Pick>>({});
  const [edits, setEdits] = useState<Record<string, DocEdit>>({});
  const [newWorkers, setNewWorkers] = useState<Record<string, { name: string; passportNumber: string; emiratesId: string; trade: string }>>({});
  const [updateExpiry, setUpdateExpiry] = useState(true);
  const [progress, setProgress] = useState({ done: 0, total: 0, label: "" });
  const [outcome, setOutcome] = useState<{ batchId: string; results: Result[] } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const dirRef = useRef<HTMLInputElement>(null);
  const noun = audience === "EMPLOYEE" ? "worker" : "supplier";

  async function begin(list: File[]) {
    if (list.length === 0) return;
    setBusy(true); setError(null); setNotice(null);
    setStep("reading");
    try {
      const all = await collect(list);
      if (all.length === 0) throw new Error("Nothing to upload in that selection.");
      const total = all.filter((s) => MIME_BY_EXT[extOf(s.path)]).length;
      setProgress({ done: 0, total, label: "Reading your files…" });
      let pagesLeft = MAX_PAGES_PER_RUN;
      let aiDown = !useAi;
      let aiNote: string | null = null;
      let done = 0;

      for (const s of all) {
        done++;
        setProgress({ done, total, label: `Reading ${baseName(s.path)}…` });
        if (aiDown || (!s.isPdf && !s.isImage) || s.size > 40 * 1024 * 1024) continue;
        let pages: PageImage[] = [];
        if (s.isPdf) {
          const r = await pdfToPages(s.blob, { maxPages: Math.min(MAX_PAGES_PER_FILE, pagesLeft) });
          if (!r) { s.note = "This PDF couldn't be opened (it may be damaged or locked), so it is matched by its name."; continue; }
          pages = r.pages; s.totalPages = r.total;
          if (r.total > pages.length) s.note = `Only the first ${pages.length} of ${r.total} pages were read.`;
        } else {
          const p = await imageToPage(s.blob);
          if (!p) { s.note = "This image format can't be read here, so it is matched by its name."; continue; }
          pages = [p]; s.totalPages = 1;
        }
        pagesLeft -= pages.length;
        pages.forEach((p) => s.thumbs.set(p.page, URL.createObjectURL(p.blob)));

        const reads: PageRead[] = [];
        let ok = true;
        for (let i = 0; i < pages.length && ok; ) {
          const group: PageImage[] = [];
          let bytes = 0;
          while (i < pages.length && group.length < 6 && (group.length === 0 || bytes + pages[i].base64.length <= 3_000_000)) { bytes += pages[i].base64.length; group.push(pages[i]); i++; }
          try {
            const res = await post<{ pages: PageRead[] }>("/api/import/documents/analyze", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ audience, pages: group.map((g) => ({ ref: String(g.page), image: g.base64 })) }) });
            reads.push(...res.pages);
          } catch (e) {
            ok = false;
            const status = (e as Error & { status?: number }).status;
            if (status === 503) { aiDown = true; aiNote = "AI reading isn't switched on, so files are matched by their names."; }
            else s.note = `The AI couldn't read this file${e instanceof Error ? ` (${e.message})` : ""}. It is matched by its name.`;
          }
        }
        pages.forEach((p) => { p.base64 = ""; });
        if (ok && reads.length) s.docs = groupPages(s.index, reads).map((d, n) => ({ docKey: `${s.index}-${n}`, type: d.type, holder: d.holder, idNumber: d.idNumber, expiry: d.expiry, confidence: d.confidence, pages: d.pages, fields: d.fields }));
        if (ok && reads.length && !s.docs?.length) s.note = "No documents were found in this file (all pages looked blank).";
      }
      if (aiNote) setNotice(aiNote);

      setProgress({ done: total, total, label: "Working out who each document belongs to…" });
      const res = await post<Plan>("/api/import/documents/plan", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ audience, files: all.map((s) => ({ index: s.index, path: s.path, size: s.size, docs: s.docs })) }) });
      const initial: Record<string, Pick> = {};
      for (const o of res.owners) if (o.match.status === "matched") initial[o.key] = { kind: o.match.kind, id: o.match.id, name: o.match.name };
      setSources(all); setPlan(res); setOwners(initial); setEdits({});
      setNewWorkers(Object.fromEntries(res.owners.filter((o) => o.newWorker).map((o) => [o.key, o.newWorker!])));
      setStep("review");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not read those files.");
      setStep("pick");
    } finally { setBusy(false); }
  }

  const ownerOf = (d: PlanDoc): Pick | undefined => edits[d.docKey]?.owner ?? (d.ownerKey ? owners[d.ownerKey] : undefined);
  const typeOf = (d: PlanDoc) => (plan?.types.some((x) => x.value === (edits[d.docKey]?.type ?? d.type)) ? (edits[d.docKey]?.type ?? d.type) : "OTHER");
  const sendable = (plan?.docs ?? []).filter((d) => d.status === "ok" && !edits[d.docKey]?.skip).map((d) => ({ d, o: ownerOf(d) })).filter((x): x is { d: PlanDoc; o: Exclude<Pick, "skip"> } => !!x.o && x.o !== "skip");
  const labelOf = (v: string) => plan?.types.find((t) => t.value === v)?.label ?? "Document";

  async function upload() {
    if (!plan) return;
    setStep("uploading"); setError(null);
    const queue = sendable.slice();
    setProgress({ done: 0, total: queue.length, label: "Preparing…" });
    try {
      const label = `${queue.length} document${queue.length === 1 ? "" : "s"}`;
      const { batchId } = await post<{ batchId: string }>("/api/import/documents/start", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ label, total: queue.length }) });
      const results: Result[] = [];
      // Workers the person chose to add are created first, inside the same upload.
      const created = new Map<string, { id: string; name: string }>();
      for (const key of new Set(queue.filter((q) => q.o === "new").map((q) => q.d.ownerKey!))) {
        const w = newWorkers[key];
        try {
          const r = await post<{ id: string; name: string }>(`/api/import/documents/${batchId}/worker`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(w) });
          created.set(key, r);
        } catch (e) { results.push({ name: w?.name ?? key, status: "failed", message: `Couldn't add the worker: ${e instanceof Error ? e.message : "failed"}` }); }
      }
      type Item = { file: File; ownerKind: "EMPLOYEE" | "SUPPLIER"; ownerId: string; type: string; expiry: string; fields?: Record<string, string> };
      const items: Item[] = [];
      for (const { d, o } of queue) {
        const src = sources[d.index];
        const owner = o === "new" ? (created.get(d.ownerKey!) ? { kind: "EMPLOYEE" as const, id: created.get(d.ownerKey!)!.id } : null) : { kind: o.kind, id: o.id };
        const type = typeOf(d);
        const display = `${baseName(src.path)} - ${labelOf(type)}`;
        if (!owner) continue;
        let file: File | null = null;
        const whole = !src.isPdf || d.pages.length === 0 || (src.totalPages > 0 && d.pages.length === src.totalPages);
        if (src.isPdf && !whole) {
          const blob = await cutPdf(src.blob, d.pages);
          if (blob) file = new File([blob], `${display} (p${d.pages[0]}${d.pages.length > 1 ? `-${d.pages[d.pages.length - 1]}` : ""}).pdf`, { type: "application/pdf" });
        } else {
          const orig = new File([src.blob], src.path.replace(/\\/g, "/").split("/").pop() ?? "file", { type: MIME_BY_EXT[extOf(src.path)] });
          file = src.isImage ? await shrinkImage(orig) : orig;
        }
        if (!file) { results.push({ name: display, status: "failed", message: "This document couldn't be cut out of its PDF." }); continue; }
        if (file.size > MAX_BULK_FILE_BYTES) { results.push({ name: file.name, status: "failed", message: `Over ${(MAX_BULK_FILE_BYTES / 1048576).toFixed(1)} MB. Compress it, or add it from the profile.` }); continue; }
        items.push({ file, ownerKind: owner.kind, ownerId: owner.id, type, expiry: edits[d.docKey]?.expiry ?? d.expiry, fields: src.docs?.find((x) => x.docKey === d.docKey)?.fields });
      }
      setProgress({ done: 0, total: items.length, label: "Uploading…" });
      let i = 0;
      while (i < items.length) {
        const group: Item[] = [];
        let bytes = 0;
        while (i < items.length && group.length < MAX_BATCH_FILES && (group.length === 0 || bytes + items[i].file.size <= MAX_BATCH_BYTES)) { bytes += items[i].file.size; group.push(items[i]); i++; }
        const form = new FormData();
        form.set("meta", JSON.stringify(group.map((g) => ({ name: g.file.name, ownerKind: g.ownerKind, ownerId: g.ownerId, type: g.type, expiry: g.expiry || null, updateExpiry, fields: g.fields }))));
        group.forEach((g, k) => form.set(`file${k}`, g.file));
        try {
          const r = await post<{ results: Result[] }>(`/api/import/documents/${batchId}/upload`, { method: "POST", body: form });
          results.push(...r.results);
        } catch (e) {
          results.push(...group.map((g) => ({ name: g.file.name, status: "failed", message: e instanceof Error ? e.message : "Could not be sent." })));
        }
        setProgress({ done: Math.min(i, items.length), total: items.length, label: "Uploading…" });
      }
      await post(`/api/import/documents/${batchId}/finish`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ rows: results }) });
      setOutcome({ batchId, results });
      setStep("done");
    } catch (e) {
      setError(e instanceof Error ? e.message : "The upload stopped.");
      setStep("review");
    }
  }

  const pickOptions = (): SelectOption[] => [
    ...(plan?.pickList.employees ?? []).map((e) => ({ value: `E:${e.id}`, label: e.label, icon: <EmployeeAvatar employeeId={e.id} name={e.name} hasPhoto={e.photo} size="xs" /> })),
    ...(plan?.pickList.suppliers ?? []).map((s) => ({ value: `S:${s.id}`, label: s.label })),
  ];
  const fromValue = (v: string): Pick => {
    const id = v.slice(2);
    return v.startsWith("E:") ? { kind: "EMPLOYEE", id, name: plan?.pickList.employees.find((e) => e.id === id)?.label ?? "" } : { kind: "SUPPLIER", id, name: plan?.pickList.suppliers.find((s) => s.id === id)?.label ?? "" };
  };
  const pickValue = (p?: Pick) => (p && p !== "skip" && p !== "new" ? `${p.kind === "EMPLOYEE" ? "E" : "S"}:${p.id}` : "");

  /* ---------------------------------------------------------------- choose who the documents are for */
  if (step === "audience") {
    return (
      <div className="space-y-4">
        <p className="text-sm font-semibold text-primary">Whose documents are these?</p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {([["EMPLOYEE", "Employees", "Passport, Emirates ID, visa, labour card, medical and so on.", HardHat], ["SUPPLIER", "Suppliers", "Trade licence, MOHRE permit, establishment card, insurance, contracts.", Truck]] as const).map(([v, title, hint, Icon]) => (
            <button key={v} type="button" onClick={() => { setAudience(v); setStep("pick"); }} className="card flex items-start gap-3 p-5 text-left transition hover:border-[var(--brand-primary-border)] hover:shadow-md">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-soft text-[var(--brand-primary)]"><Icon className="h-5 w-5" aria-hidden /></span>
              <span><span className="block text-base font-semibold text-primary">{title}</span><span className="mt-0.5 block text-sm text-secondary">{hint}</span></span>
            </button>
          ))}
        </div>
      </div>
    );
  }

  /* ---------------------------------------------------------------- choose the files */
  if (step === "pick") {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm text-secondary">Importing documents for <span className="font-semibold text-primary">{audience === "EMPLOYEE" ? "employees" : "suppliers"}</span>.</p>
          <button type="button" className="text-xs font-medium text-[var(--brand-primary)] hover:underline" onClick={() => setStep("audience")}>Change</button>
        </div>
        <div className="card flex flex-col items-center gap-3 border-dashed p-10 text-center" onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); void begin([...e.dataTransfer.files]); }}>
          <UploadCloud className="h-8 w-8 text-[var(--brand-primary)]" aria-hidden />
          <p className="text-sm font-semibold text-primary">Drop your documents here</p>
          <ul className="max-w-xl space-y-1 text-xs text-muted">
            <li><strong className="text-secondary">One PDF per {noun}</strong> with each document on its own pages (passport, then Emirates ID, then visa&hellip;). The AI finds where each document starts and ends and files them separately. A PDF with several {noun}s one after another works too.</li>
            <li><strong className="text-secondary">A folder or ZIP</strong> with one folder per {noun}, or loose files. The AI reads each file, so the file names can be anything.</li>
          </ul>
          <div className="flex flex-wrap justify-center gap-2">
            <button type="button" className="btn btn-primary flex gap-1.5" disabled={busy} onClick={() => fileRef.current?.click()}><FileText className="h-4 w-4" aria-hidden />Choose files or a ZIP</button>
            <button type="button" className="btn btn-secondary flex gap-1.5" disabled={busy} onClick={() => dirRef.current?.click()}><FolderUp className="h-4 w-4" aria-hidden />Choose a folder</button>
          </div>
          <label className="flex max-w-xl items-start gap-2 text-left text-xs text-secondary">
            <input type="checkbox" checked={useAi} onChange={(e) => setUseAi(e.target.checked)} className="mt-0.5 h-4 w-4 accent-[var(--brand-primary)]" />
            <span><span className="font-medium text-primary">Read the pages with AI</span> (recommended). The page images are sent to the AI service to identify them, and are not kept. Untick to match by file and folder names only.</span>
          </label>
          <input ref={fileRef} type="file" multiple accept=".zip,.pdf,.jpg,.jpeg,.png,.gif,.webp,.heic,.heif,.doc,.docx,.xls,.xlsx" className="hidden" onChange={(e) => void begin([...(e.target.files ?? [])])} />
          <input ref={dirRef} type="file" multiple className="hidden" onChange={(e) => void begin([...(e.target.files ?? [])].filter((f) => MIME_BY_EXT[extOf(f.name)]))} {...({ webkitdirectory: "" } as object)} />
        </div>
        {error && <p className="rounded-lg border border-[var(--error-border)] bg-[var(--error-soft)] px-4 py-3 text-sm text-[var(--error)]">{error}</p>}
      </div>
    );
  }

  if (step === "reading") {
    const pct = progress.total ? Math.round((progress.done / progress.total) * 100) : 0;
    return (
      <div className="card space-y-3 p-6">
        <p className="flex items-center gap-2 text-sm font-semibold text-primary"><Loader2 className="h-4 w-4 animate-spin text-[var(--brand-primary)]" aria-hidden />Reading your documents&hellip;</p>
        <div className="h-2 overflow-hidden rounded-full bg-surface-sunken" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}><div className="h-full rounded-full bg-[var(--brand-primary)] transition-all" style={{ width: `${Math.max(pct, 4)}%` }} /></div>
        <p className="tabular truncate text-xs text-muted">{progress.label} &middot; {progress.done} of {progress.total} files</p>
      </div>
    );
  }

  if (step === "uploading") {
    const pct = progress.total ? Math.round((progress.done / progress.total) * 100) : 0;
    return (
      <div className="card space-y-3 p-6">
        <p className="flex items-center gap-2 text-sm font-semibold text-primary"><Loader2 className="h-4 w-4 animate-spin text-[var(--brand-primary)]" aria-hidden />{progress.label || "Uploading…"}</p>
        <div className="h-2 overflow-hidden rounded-full bg-surface-sunken" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}><div className="h-full rounded-full bg-[var(--brand-primary)] transition-all" style={{ width: `${Math.max(pct, 4)}%` }} /></div>
        <p className="tabular text-xs text-muted">{progress.done} of {progress.total} &middot; keep this page open until it finishes.</p>
      </div>
    );
  }

  if (step === "done" && outcome) {
    const bad = outcome.results.filter((r) => r.status !== "created");
    const made = outcome.results.filter((r) => r.status === "created");
    return (
      <div className="space-y-4">
        <p className="flex items-center gap-2 text-sm font-semibold text-primary"><CheckCircle2 className="h-5 w-5 text-[var(--success)]" aria-hidden />Upload finished</p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Tile label="Documents filed" value={made.length} tone="success" />
          <Tile label="Records updated" value={made.filter((r) => r.recordUpdated).length} />
          <Tile label="Already on file" value={outcome.results.filter((r) => r.status === "duplicate").length} />
          <Tile label="Failed" value={outcome.results.filter((r) => r.status === "failed").length} tone={outcome.results.some((r) => r.status === "failed") ? "error" : undefined} />
        </div>
        {bad.length > 0 && (
          <ul className="card divide-y divide-[var(--border)] text-sm">
            {bad.slice(0, 50).map((r, k) => <li key={k} className="flex justify-between gap-3 px-4 py-2"><span className="truncate text-primary">{r.name}</span><span className="shrink-0 text-xs text-muted">{r.message}</span></li>)}
          </ul>
        )}
        <div className="flex flex-wrap items-center gap-4 border-t border-default pt-4">
          <Link href="/import" className="btn btn-secondary">Back to Import data</Link>
          <button type="button" className="btn btn-secondary" onClick={() => { setStep("pick"); setPlan(null); setOutcome(null); setSources([]); }}>Upload more</button>
          <UndoImportButton batchId={outcome.batchId} />
        </div>
      </div>
    );
  }

  /* ---------------------------------------------------------------- review */
  if (!plan) return null;
  const skipped = plan.docs.filter((d) => d.status === "skip");
  const unresolved = plan.docs.filter((d) => d.status === "ok" && !edits[d.docKey]?.skip && !ownerOf(d)).length;
  const aiRead = plan.docs.filter((d) => d.readByAi).length;
  const lowCount = plan.docs.filter((d) => d.readByAi && d.confidence === "low").length;
  return (
    <div className="space-y-4">
      <div className="card flex flex-wrap items-center justify-between gap-3 p-4">
        <div>
          <p className="text-sm font-semibold text-primary">{plan.docs.filter((d) => d.status === "ok").length} document{plan.docs.filter((d) => d.status === "ok").length === 1 ? "" : "s"} found &middot; {sendable.length} ready to file</p>
          <p className="mt-0.5 text-xs text-muted">{aiRead > 0 ? `${aiRead} read by AI${lowCount ? `, ${lowCount} marked "check"` : ""}. ` : ""}Check who each belongs to and its type. Nothing is saved until you press Upload.</p>
        </div>
        {plan.owners.some((o) => !owners[o.key] && o.ai?.id) && (
          <button type="button" className="btn btn-secondary btn-sm flex gap-1.5" onClick={() => setOwners((p) => {
            const next = { ...p };
            for (const o of plan.owners) if (!next[o.key] && o.ai?.id && o.ai.confidence !== "low" && o.match.status !== "matched") { const c = o.match.candidates.find((x) => x.id === o.ai!.id); if (c) next[o.key] = { kind: c.kind, id: c.id, name: c.name }; }
            return next;
          })}><Sparkles className="h-3.5 w-3.5" aria-hidden />Use AI suggestions</button>
        )}
      </div>
      {notice && <p className="rounded-lg border border-[var(--warning-border)] bg-[var(--warning-soft)] px-4 py-3 text-sm text-[var(--warning)]">{notice}</p>}
      <label className="flex items-start gap-2 rounded-lg border border-default px-4 py-3 text-sm text-secondary">
        <input type="checkbox" checked={updateExpiry} onChange={(e) => setUpdateExpiry(e.target.checked)} className="mt-0.5 h-4 w-4 accent-[var(--brand-primary)]" />
        <span><span className="font-medium text-primary">Fill the {noun} record from the documents</span>: numbers, date of birth, nationality, expiry dates and so on. Empty fields are filled; nothing already there is overwritten, and an expiry is only changed when the new date is later.</span>
      </label>

      {plan.owners.map((o) => {
        const chosen = owners[o.key];
        const docs = plan.docs.filter((d) => d.ownerKey === o.key && d.status === "ok");
        const isNew = chosen === "new";
        return (
          <div key={o.key} className="card space-y-3 p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm text-primary"><span className="font-medium">{o.label}</span> <span className="text-muted">&middot; {docs.length} document{docs.length === 1 ? "" : "s"}</span></p>
                {chosen && chosen !== "skip" && chosen !== "new" && <p className="mt-0.5 text-xs text-[var(--success)]">{chosen.kind === "SUPPLIER" ? "Supplier" : "Worker"}: {chosen.name}</p>}
                {chosen === "skip" && <p className="mt-0.5 text-xs text-muted">These documents will be left out.</p>}
                {isNew && <p className="mt-0.5 text-xs text-[var(--brand-primary)]">A new worker will be added with the details below.</p>}
                {!chosen && <p className="mt-0.5 text-xs text-[var(--warning)]">{o.match.status === "unknown" ? `No ${noun} by that name.` : o.match.status === "several" ? "More than one has that name." : "No exact match; close ones below."}</p>}
              </div>
              <div className="flex w-80 max-w-full items-center gap-2">
                <div className="min-w-0 flex-1"><Select value={pickValue(chosen)} onChange={(v) => setOwners((p) => ({ ...p, [o.key]: fromValue(v) }))} placeholder={`Choose ${noun}…`} searchPlaceholder="Search…" options={pickOptions()} /></div>
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
            {audience === "EMPLOYEE" && o.newWorker && !chosen && (
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => setOwners((p) => ({ ...p, [o.key]: "new" }))}>Add as a new worker</button>
            )}
            {isNew && newWorkers[o.key] && (
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                {([["name", "Name"], ["passportNumber", "Passport no."], ["emiratesId", "Emirates ID"]] as const).map(([k, label]) => (
                  <label key={k} className="text-xs text-muted">{label}
                    <input value={newWorkers[o.key][k]} onChange={(e) => setNewWorkers((p) => ({ ...p, [o.key]: { ...p[o.key], [k]: e.target.value } }))} className="input mt-0.5 w-full px-2 py-1.5 text-sm" />
                  </label>
                ))}
                <div className="sm:col-span-3"><button type="button" className="text-xs text-muted hover:underline" onClick={() => setOwners((p) => { const n = { ...p }; delete n[o.key]; return n; })}>Don&rsquo;t add</button></div>
              </div>
            )}
            <DocRows docs={docs} types={plan.types} edits={edits} setEdits={setEdits} sources={sources} dim={chosen === "skip"} />
          </div>
        );
      })}

      {plan.docs.some((d) => d.status === "ok" && !d.ownerKey) && (
        <div className="card space-y-2 p-4">
          <p className="text-sm font-semibold text-primary">Documents with no name or number I could use &middot; {plan.docs.filter((d) => d.status === "ok" && !d.ownerKey).length}</p>
          <p className="text-xs text-muted">Choose who each belongs to, or leave it out.</p>
          <DocRows docs={plan.docs.filter((d) => d.status === "ok" && !d.ownerKey)} types={plan.types} edits={edits} setEdits={setEdits} sources={sources} withOwner pickOptions={pickOptions()} fromValue={fromValue} pickValue={pickValue} />
        </div>
      )}

      {skipped.length > 0 && (
        <details className="card p-4 text-sm">
          <summary className="cursor-pointer select-none font-medium text-primary">{skipped.length} file{skipped.length === 1 ? "" : "s"} can&rsquo;t be uploaded</summary>
          <ul className="mt-2 space-y-1 text-xs text-muted">{skipped.slice(0, 100).map((d) => <li key={d.docKey}><span className="text-primary">{d.fileName}</span> &mdash; {d.reason}</li>)}</ul>
        </details>
      )}
      {sources.some((s) => s.note) && (
        <details className="card p-4 text-sm">
          <summary className="cursor-pointer select-none font-medium text-primary">Notes about some files</summary>
          <ul className="mt-2 space-y-1 text-xs text-muted">{sources.filter((s) => s.note).slice(0, 100).map((s) => <li key={s.index}><span className="text-primary">{s.path}</span> &mdash; {s.note}</li>)}</ul>
        </details>
      )}

      {error && <p className="flex items-start gap-2 rounded-lg border border-[var(--error-border)] bg-[var(--error-soft)] px-4 py-3 text-sm text-[var(--error)]"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />{error}</p>}
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-default pt-4">
        <button type="button" className="btn btn-secondary" onClick={() => { setStep("pick"); setPlan(null); setSources([]); }}>Start again</button>
        {unresolved > 0 && <p className="text-xs text-[var(--warning)]">{unresolved} document{unresolved === 1 ? "" : "s"} with no owner chosen will be left out.</p>}
        <button type="button" className="btn btn-primary" disabled={sendable.length === 0} onClick={() => void upload()}>Upload {sendable.length} document{sendable.length === 1 ? "" : "s"}</button>
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

function DocRows({ docs, types, edits, setEdits, sources, dim, withOwner, pickOptions, fromValue, pickValue }: {
  docs: PlanDoc[];
  types: Opt[];
  edits: Record<string, DocEdit>;
  setEdits: React.Dispatch<React.SetStateAction<Record<string, DocEdit>>>;
  sources: Source[];
  dim?: boolean;
  withOwner?: boolean;
  pickOptions?: SelectOption[];
  fromValue?: (v: string) => Pick;
  pickValue?: (p?: Pick) => string;
}) {
  const patch = (k: string, v: Partial<DocEdit>) => setEdits((p) => ({ ...p, [k]: { ...p[k], ...v } }));
  return (
    <ul className={cn("divide-y divide-[var(--border)] rounded-lg border border-default", dim && "opacity-50")}>
      {docs.map((d) => {
        const e = edits[d.docKey] ?? {};
        const src = sources[d.index];
        const thumb = src?.thumbs.get(d.pages[0] ?? 1);
        const pageText = d.pages.length ? (src?.totalPages > 1 ? `page${d.pages.length > 1 ? "s" : ""} ${d.pages[0]}${d.pages.length > 1 ? `–${d.pages[d.pages.length - 1]}` : ""} of ${src.totalPages}` : "") : "";
        return (
          <li key={d.docKey} className={cn("flex flex-wrap items-center gap-3 px-3 py-2 text-sm", e.skip && "opacity-40")}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {thumb ? <img src={thumb} alt="" className="h-14 w-10 shrink-0 rounded border border-default object-cover object-top" /> : <span className="flex h-14 w-10 shrink-0 items-center justify-center rounded border border-default text-muted"><FileText className="h-4 w-4" aria-hidden /></span>}
            <span className="min-w-0 flex-1">
              <span className="block truncate text-primary" title={src?.path}>{d.fileName}</span>
              <span className="block truncate text-xs text-muted">
                {pageText}{pageText && d.via ? " · " : ""}{d.via ? `matched by ${d.via}` : ""}
                {d.readByAi && d.confidence === "low" && <span className="ml-1 font-medium text-[var(--warning)]">· check</span>}
                {d.conflict && <span className="ml-1 font-medium text-[var(--warning)]">· the file name points to someone else</span>}
              </span>
            </span>
            <div className="w-52"><Select value={types.some((t) => t.value === (e.type ?? d.type)) ? (e.type ?? d.type) : "OTHER"} onChange={(v) => patch(d.docKey, { type: v })} searchable={false} options={types} /></div>
            <input type="date" value={e.expiry ?? d.expiry} onChange={(ev) => patch(d.docKey, { expiry: ev.target.value })} className="input w-40 px-2 py-1.5 text-sm" aria-label={`Expiry date for ${d.fileName}`} title="Expiry date (optional)" />
            {withOwner && pickOptions && fromValue && pickValue && <div className="w-60"><Select value={pickValue(e.owner)} onChange={(v) => patch(d.docKey, { owner: fromValue(v) })} placeholder="Choose…" options={pickOptions} /></div>}
            <button type="button" className="text-xs text-muted hover:underline" onClick={() => patch(d.docKey, { skip: !e.skip })}>{e.skip ? "Include" : "Leave out"}</button>
          </li>
        );
      })}
    </ul>
  );
}
