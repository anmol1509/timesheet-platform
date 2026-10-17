"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { DrawerFrame } from "@/components/quick-view/DrawerFrame";
import { ScanDrop } from "@/components/quick-view/ScanDrop";
import { ScanSummary, type ScanSummaryData } from "@/components/quick-view/ScanSummary";
import { ChoiceField, ClickToEdit, Notice, Pill, Row, TextEditor, useFieldFlow, type Kind, type SaveResult } from "@/components/quick-view/fields";
import { complianceStatus, daysUntil } from "@/lib/compliance";
import { MAX_UPLOAD_BYTES, MAX_UPLOAD_LABEL } from "@/lib/constants";
import { shrinkImage } from "@/lib/compressImage";
import { cn } from "@/lib/cn";
import type { ExtractedCompanyFields } from "@/app/api/documents/extract-company/route";

/**
 * One quick view for the two kinds of company the app keeps (suppliers and clients): contact details you can fix
 * in place, the trade licence and TRN with a scan that fills them, and a Missing tab that asks only for what a scan
 * can't supply. What differs between the two (which actions run, which extra fields and blocks) comes in through
 * the adapter.
 */
export type CompanyView = {
  id: string;
  name: string;
  code: string | null;
  /** Shown beside the code in the header, e.g. the category. */
  caption: string | null;
  badge: string;
  contactPerson: string | null;
  contactPhone: string | null;
  contactEmail: string | null;
  paymentTerms: string | null;
  trn: string | null;
  tradeLicenseNumber: string | null;
  tradeLicenseExpiry: string | null;
  documents: { id: string; docType: string; filename: string; expiryDate: string | null }[];
  canEdit: boolean;
  [extra: string]: unknown;
};

export type CompanyScanOutcome = ScanSummaryData;
type ScanActionResult = { applied: ScanSummaryData["applied"]; conflicts: ScanSummaryData["conflicts"] } | { error: string };

export type CompanyField = { key: string; label: string; kind?: Kind };
export type CompanyGap = { key: string; label: string; done: boolean; level: "Required" | "Recommended"; why: string; kind: Kind | "date" | null };

export type CompanyAdapter = {
  /** "supplier" or "client", for headings and messages. */
  noun: string;
  load: (id: string) => Promise<CompanyView | null>;
  save: (input: { id: string; field: string; value: string | null; confirm?: boolean }) => Promise<SaveResult>;
  applyScan: (input: { id: string; fields: ExtractedCompanyFields }) => Promise<ScanActionResult>;
  /** Keeps the scanned file against the company; returns an error message if it couldn't. */
  storeFile: (id: string, file: File, docType: string, expiry: string) => Promise<string | null>;
  /** Document types the scan may file a document under; anything else is filed as a trade licence. */
  docTypes: readonly string[];
  fullHref: (id: string) => string;
  /** The rows of the Overview, in order. */
  fields: CompanyField[];
  /** Licence rows beyond number, expiry and TRN (e.g. the MOHRE permit). */
  complianceFields?: CompanyField[];
  gaps: (d: CompanyView) => CompanyGap[];
  /** Blocks added to the Overview and Compliance tabs (stats, approvals…). */
  overviewExtra?: (d: CompanyView) => React.ReactNode;
  complianceExtra?: (d: CompanyView) => React.ReactNode;
};

type TabId = "overview" | "compliance" | "missing";
type Save = (field: string, value: string | null, label: string, confirm?: boolean) => Promise<SaveResult>;

const fmtDate = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" }) : "—");

function licence(iso: string | null): { tone: "ok" | "warn" | "err" | "mute"; text: string } {
  if (!iso) return { tone: "mute", text: "Not recorded" };
  const days = daysUntil(new Date(iso));
  const s = complianceStatus(new Date(iso));
  if (s === "expired") return { tone: "err", text: `Expired ${-days}d ago` };
  if (s === "expiring") return { tone: "warn", text: days === 0 ? "Expires today" : `Expires in ${days}d` };
  return { tone: "ok", text: "Valid" };
}

export function CompanyDrawer({ adapter, id, order, fallbackName, onNavigate, onClose, initialTab }: { adapter: CompanyAdapter; id: string; order: string[]; fallbackName?: string; onNavigate: (id: string) => void; onClose: () => void; initialTab?: string }) {
  const router = useRouter();
  const [state, setState] = useState<{ id: string; data: CompanyView | null } | null>(null);
  const [tab, setTab] = useState<TabId>(initialTab === "compliance" || initialTab === "missing" ? initialTab : "overview");
  const [scanState, setScanState] = useState<{ id: string; outcome: CompanyScanOutcome } | null>(null);
  const [undo, setUndo] = useState<{ field: string; label: string; previous: string | null } | null>(null);
  const data = state?.id === id ? state.data : undefined;
  const scan = scanState?.id === id ? scanState.outcome : null;

  useEffect(() => {
    let off = false;
    adapter.load(id).then((d) => { if (!off) setState({ id, data: d }); });
    return () => { off = true; };
  }, [id, adapter]);
  useEffect(() => {
    if (!undo) return;
    const t = setTimeout(() => setUndo(null), 7000);
    return () => clearTimeout(t);
  }, [undo]);

  const reload = () => { void adapter.load(id).then((d) => setState({ id, data: d })); router.refresh(); };
  const patch = (field: string, value: string | null) => setState((s) => (s && s.id === id && s.data ? { ...s, data: { ...s.data, [field]: value } } : s));

  const save: Save = async (field, value, label, confirm = false) => {
    const r = await adapter.save({ id, field, value, confirm });
    if (r.ok) { patch(field, r.value); setUndo({ field, label, previous: r.previous }); router.refresh(); }
    return r;
  };
  const doUndo = async () => {
    if (!undo) return;
    const u = undo;
    setUndo(null);
    const r = await adapter.save({ id, field: u.field, value: u.previous, confirm: true });
    if (r.ok) { patch(u.field, r.value); router.refresh(); }
  };
  const bound = (field: string, label: string) => (v: string | null, confirm?: boolean) => save(field, v, label, confirm);
  async function useScanValue(c: { key: string; label: string; scan: string }) {
    const r = await save(c.key, c.scan, c.label, true);
    if (r.ok) setScanState((s) => (s && s.id === id ? { ...s, outcome: { ...s.outcome, conflicts: s.outcome.conflicts.filter((x) => x.key !== c.key) } } : s));
  }
  function onScanDone(outcome: CompanyScanOutcome) { setScanState({ id, outcome }); reload(); }

  const index = order.indexOf(id);
  const go = (delta: number) => { if (order.length > 1) onNavigate(order[(index + delta + order.length) % order.length]); };
  const gaps = useMemo(() => (data ? adapter.gaps(data) : []), [data, adapter]);
  const open = gaps.filter((g) => !g.done);
  const pct = gaps.length ? Math.round(((gaps.length - open.length) / gaps.length) * 100) : 100;
  const lic = data ? licence(data.tradeLicenseExpiry) : null;
  const tabs = [
    { id: "overview", label: "Overview" },
    { id: "compliance", label: "Compliance" },
    { id: "missing", label: "Missing", count: open.length },
  ];
  const cell = (d: CompanyView, key: string) => (d[key] as string | null | undefined) ?? null;

  return (
    <DrawerFrame
      index={index}
      total={order.length}
      onStep={go}
      fullHref={adapter.fullHref(id)}
      fullLabel={`Open full ${adapter.noun}`}
      title={data ? data.name : (fallbackName ?? "Loading…")}
      subtitle={data ? [data.code, data.caption].filter(Boolean).join(" · ") : undefined}
      badge={data?.badge}
      tabs={tabs}
      tab={tab}
      onTab={(t) => setTab(t as TabId)}
      undo={undo ? { label: undo.label, onUndo: () => void doUndo() } : null}
      nextLabel={`Next ${adapter.noun}`}
      onNext={() => go(1)}
      nextDisabled={order.length < 2}
      onClose={onClose}
    >
      {data === undefined && <div className="space-y-3" aria-busy="true">{[0, 1, 2, 3].map((n) => <div key={n} className="h-10 animate-pulse rounded-xl bg-surface-sunken" />)}</div>}
      {data === null && <p className="py-10 text-center text-sm text-muted">This {adapter.noun} couldn&apos;t be found.</p>}
      {data && !data.canEdit && <p className="mb-3 rounded-lg bg-surface-sunken px-3 py-2 text-xs text-muted">You can view this {adapter.noun} but not edit it.</p>}

      {data && tab === "overview" && (
        <div className="space-y-4">
          {lic && (lic.tone === "err" || lic.tone === "warn") && (
            <div className={cn("flex items-center gap-3 rounded-[14px] border px-3 py-2.5 text-sm", lic.tone === "err" ? "border-[var(--error-border)] bg-[var(--error-soft)]" : "border-[var(--warning-border)] bg-[var(--warning-soft)]")}>
              <span className="flex-1 text-primary"><b>Trade licence {lic.text.toLowerCase()}.</b></span>
              <button type="button" className="btn btn-primary btn-sm" onClick={() => setTab("compliance")}>Renew</button>
            </div>
          )}
          <fieldset disabled={!data.canEdit} className="min-w-0">
            <h3 className="mb-2 text-xs font-semibold text-primary">Key details <span className="font-normal text-muted">· click a value to edit</span></h3>
            <dl className="rounded-[14px] border border-default">
              {adapter.fields.map((f) => (
                <Row key={f.key} label={f.label}><ClickToEdit label={f.label.toLowerCase()} kind={f.kind} value={cell(data, f.key)} onSave={bound(f.key, f.label)} /></Row>
              ))}
            </dl>
          </fieldset>
          {adapter.overviewExtra?.(data)}
        </div>
      )}

      {data && tab === "compliance" && (
        <fieldset disabled={!data.canEdit} className="min-w-0 space-y-3">
          {scan && <ScanSummary outcome={scan} onUse={useScanValue} onDismiss={() => setScanState(null)} />}
          <CompanyScan adapter={adapter} id={id} onDone={onScanDone} title="Scan the trade licence" hint="Licence number, expiry, TRN and contact details are read and saved." />
          <dl className="rounded-[14px] border border-default">
            <Row label="Licence no."><ClickToEdit label="trade licence number" value={data.tradeLicenseNumber} onSave={bound("tradeLicenseNumber", "Trade licence number")} /></Row>
            <Row label="Expires">
              <ChoiceField kind="date" value={data.tradeLicenseExpiry} onSave={bound("tradeLicenseExpiry", "Trade licence expiry")} />
              {lic && <div className="mt-1"><Pill tone={lic.tone}>{lic.text}</Pill></div>}
            </Row>
            <Row label="TRN"><ClickToEdit label="TRN" kind="trn" value={data.trn} onSave={bound("trn", "TRN")} /></Row>
            {adapter.complianceFields?.map((f) => (
              <Row key={f.key} label={f.label}><ClickToEdit label={f.label.toLowerCase()} kind={f.kind} value={cell(data, f.key)} onSave={bound(f.key, f.label)} /></Row>
            ))}
          </dl>
          {adapter.complianceExtra?.(data)}
          {data.documents.length > 0 && (
            <div>
              <h3 className="mb-2 text-xs font-semibold text-primary">Documents on file</h3>
              <ul className="rounded-[14px] border border-default text-sm">
                {data.documents.map((a) => (
                  <li key={a.id} className="flex items-center justify-between gap-3 border-b border-default px-3 py-2 last:border-b-0">
                    <span className="min-w-0"><span className="block truncate font-medium text-primary">{a.filename}</span><span className="text-xs text-muted">{a.docType.replace(/_/g, " ").toLowerCase()}{a.expiryDate && ` · expires ${fmtDate(a.expiryDate)}`}</span></span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </fieldset>
      )}

      {data && tab === "missing" && (
        <fieldset disabled={!data.canEdit} className="min-w-0 space-y-3">
          <div className="flex items-center gap-3 rounded-[14px] border border-default bg-brand-soft px-3 py-2.5">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full" style={{ background: `conic-gradient(var(--brand-primary) 0 ${pct}%, var(--border) ${pct}% 100%)` }}>
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-surface text-[11px] font-bold">{pct}%</span>
            </div>
            <p className="text-sm"><b>{gaps.length - open.length} of {gaps.length} profile items done.</b><br /><span className="text-xs text-muted">{open.length ? "Scan first; type only what is left." : "Nothing is missing."}</span></p>
          </div>
          {scan && <ScanSummary outcome={scan} onUse={useScanValue} onDismiss={() => setScanState(null)} />}
          {open.some((g) => ["tradeLicenseNumber", "tradeLicenseExpiry", "trn", "scan"].includes(g.key)) && (
            <CompanyScan adapter={adapter} id={id} onDone={onScanDone} title="Scan the trade licence" hint="Licence number, expiry and TRN are read and saved." />
          )}
          {open.some((g) => g.key !== "scan") && (
            <div className="rounded-[14px] border border-default">
              {open.filter((g) => g.key !== "scan").map((g) => <GapRow key={g.key} gap={g} save={save} />)}
            </div>
          )}
          {gaps.some((g) => g.done) && (
            <div>
              <h3 className="mb-2 text-xs font-semibold text-primary">Already done</h3>
              <p className="rounded-[14px] border border-default px-3 py-2.5 text-sm text-muted">{gaps.filter((g) => g.done).map((g) => `✓ ${g.label}`).join(" · ")}</p>
            </div>
          )}
        </fieldset>
      )}
    </DrawerFrame>
  );
}

function GapRow({ gap, save }: { gap: CompanyGap; save: Save }) {
  const [draft, setDraft] = useState("");
  const onSave = (v: string | null, confirm?: boolean) => save(gap.key, v, gap.label, confirm);
  const flow = useFieldFlow(onSave);
  const text = gap.kind && gap.kind !== "date" ? gap.kind : null;
  return (
    <div className="border-b border-default px-3 py-3 last:border-b-0">
      <div className="flex items-baseline justify-between gap-2">
        <b className="text-sm font-semibold text-primary">{gap.label}</b>
        <Pill tone={gap.level === "Required" ? "err" : "warn"}>{gap.level}</Pill>
      </div>
      {gap.why && <p className="mt-0.5 text-[11px] text-muted">{gap.why}</p>}
      <div className="mt-2">
        {text ? (
          <form className="flex items-start gap-2" onSubmit={(e) => { e.preventDefault(); if (draft.trim()) void flow.run(draft.trim()); }}>
            <div className="min-w-0 flex-1"><TextEditor kind={text} value={draft} onChange={setDraft} /></div>
            <button type="submit" className="btn btn-primary" disabled={!draft.trim() || flow.busy}>Save</button>
          </form>
        ) : (
          <ChoiceField kind="date" value={null} onSave={onSave} />
        )}
        {text && <Notice msg={flow.msg} onConfirm={() => void flow.run(draft.trim(), true)} onDismiss={flow.clear} />}
      </div>
    </div>
  );
}

/**
 * One way to add a company document: it is read, kept against the company, and everything readable is put on the
 * record in the same step, so nothing is typed that the scan already said.
 */
function CompanyScan({ adapter, id, onDone, title, hint }: { adapter: CompanyAdapter; id: string; onDone: (o: CompanyScanOutcome) => void; title: string; hint: string }) {
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const abort = useRef<AbortController | null>(null);

  async function run(files: File[]) {
    if (files.length === 0) return;
    setError(null);
    const ac = new AbortController();
    abort.current = ac;
    const out: CompanyScanOutcome = { applied: [], conflicts: [], files: 0, unread: 0, reason: null };
    try {
      for (const [n, raw] of files.entries()) {
        if (ac.signal.aborted) break;
        setStatus(files.length > 1 ? `Reading ${n + 1} of ${files.length}…` : "Reading the document…");
        const file = await shrinkImage(raw);
        if (file.size > MAX_UPLOAD_BYTES) { setError(`"${file.name}" is too large — max ${MAX_UPLOAD_LABEL}.`); continue; }
        let fields: ExtractedCompanyFields = {};
        if (file.type.startsWith("image/") || file.type === "application/pdf") {
          const body = new FormData();
          body.append("file", file);
          const res = await fetch("/api/documents/extract-company", { method: "POST", body, signal: ac.signal }).catch(() => null);
          if (ac.signal.aborted) break;
          const payload = res ? await res.json().catch(() => null) : null;
          if (res?.ok && payload) fields = payload as ExtractedCompanyFields;
          else { out.unread++; out.reason = (payload && typeof payload.error === "string" && payload.error) || "The document couldn't be read."; }
        }
        setStatus("Saving…");
        const docType = fields.docType && adapter.docTypes.includes(fields.docType) ? fields.docType : "TRADE_LICENSE";
        const problem = await adapter.storeFile(id, file, docType, fields.documentExpiry || (docType === "TRADE_LICENSE" ? fields.tradeLicenseExpiry || "" : ""));
        if (problem) { setError(problem); continue; }
        out.files++;
        if (Object.keys(fields).length > 0) {
          const a = await adapter.applyScan({ id, fields });
          if ("error" in a) setError(a.error);
          else {
            for (const x of a.applied) if (!out.applied.some((y) => y.key === x.key)) out.applied.push(x);
            for (const c of a.conflicts) if (!out.conflicts.some((y) => y.key === c.key)) out.conflicts.push(c);
          }
        }
      }
    } catch {
      setError("That didn't upload. Please try again.");
    } finally {
      setStatus(null);
    }
    if (ac.signal.aborted) setError(out.files > 0 ? `Stopped. ${out.files} ${out.files === 1 ? "file was" : "files were"} already saved.` : "Cancelled. Nothing was saved.");
    if (out.files > 0) onDone(out);
  }

  return <ScanDrop title={title} hint={hint} compact multiple status={status} error={error} onFiles={(f) => void run(f)} onCancel={() => abort.current?.abort()} />;
}
