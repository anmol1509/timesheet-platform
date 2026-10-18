"use client";

import type { PaperMarginSet } from "@/lib/paperMargins";
import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Download, Search } from "lucide-react";
import { PAYSLIP_HIDEABLE, applyPayslipView } from "@/lib/payslipView";
import { savePayslipDefaultAction } from "./actions";
import { PayslipCard } from "@/components/PayslipCard";
import type { PayslipDoc } from "@/lib/payslipData";
import type { IssuerOption } from "@/lib/employeeLetterIssuer";
import { PrintButton } from "./print-button";

/**
 * Payslips of a run, laid out like the Letters screen: pick who gets one (one, several or all), choose
 * plain paper or letterhead and whether to sign and stamp, watch the preview change, then download.
 */
export function PayslipStudio({ runId, doc: fullDoc, issuer, margins, defaultHidden, preselect }: { runId: string; doc: PayslipDoc; issuer: IssuerOption; margins: PaperMarginSet; defaultHidden: string[]; preselect: string | null }) {
  // Lines left off the payslip are folded into Other earnings / deductions, so totals and net pay never change.
  const [hidden, setHidden] = useState<string[]>(defaultHidden);
  const [savedHidden, setSavedHidden] = useState<string[]>(defaultHidden);
  const [savingDefault, setSavingDefault] = useState(false);
  const [defaultError, setDefaultError] = useState<string | null>(null);
  const doc = useMemo(() => applyPayslipView(fullDoc, hidden), [fullDoc, hidden]);
  const [picked, setPicked] = useState<Set<string>>(() => new Set(preselect ? [preselect] : doc.slips.map((s) => s.lineId)));
  const [query, setQuery] = useState("");
  const [onLetterhead, setOnLetterhead] = useState(false);
  const [showSignature, setShowSignature] = useState(false);
  const [showStamp, setShowStamp] = useState(false);
  const [signatoryName, setSignatoryName] = useState(issuer.signatoryName);
  const [signatoryTitle, setSignatoryTitle] = useState(issuer.signatoryTitle);
  const [viewing, setViewing] = useState<string | null>(preselect);

  const shown = useMemo(() => doc.slips.map((s, i) => ({ s, i })).filter(({ s }) => `${s.employee.name} ${s.employee.idNo}`.toLowerCase().includes(query.trim().toLowerCase())), [doc.slips, query]);
  const chosen = doc.slips.map((s, i) => ({ s, i })).filter(({ s }) => picked.has(s.lineId));
  const current = chosen.find(({ s }) => s.lineId === viewing) ?? chosen[0] ?? null;
  const at = current ? chosen.findIndex(({ s }) => s.lineId === current.s.lineId) : -1;

  const toggle = (id: string) => setPicked((p) => { const n = new Set(p); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const allShownPicked = shown.length > 0 && shown.every(({ s }) => picked.has(s.lineId));

  const params = new URLSearchParams();
  // Everybody picked means the whole run: leave the list out so the link stays short and covers any later additions.
  if (picked.size > 0 && picked.size < doc.slips.length) params.set("lines", chosen.map(({ s }) => s.lineId).join(","));
  if (onLetterhead) params.set("letterhead", "1");
  if (showSignature) params.set("signature", "1");
  if (showStamp) params.set("stamp", "1");
  if ((showSignature || showStamp) && signatoryName.trim()) params.set("name", signatoryName.trim());
  if ((showSignature || showStamp) && signatoryTitle.trim()) params.set("title", signatoryTitle.trim());
  // Always stated, so the download matches the preview even when it differs from the company default.
  params.set("hide", hidden.join(","));
  const pdf = `/api/payroll/${runId}/payslips?${params}`;
  const hiddenChanged = hidden.slice().sort().join(",") !== savedHidden.slice().sort().join(",");
  const toggleHidden = (key: string) => setHidden((h) => (h.includes(key) ? h.filter((k) => k !== key) : [...h, key]));
  async function saveDefault() {
    setSavingDefault(true);
    setDefaultError(null);
    const r = await savePayslipDefaultAction(runId, hidden).catch(() => ({ error: "Could not save." }));
    setSavingDefault(false);
    if (r.error) setDefaultError(r.error); else setSavedHidden(hidden);
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[22rem_1fr]">
      <div className="space-y-5 print:hidden">
        <section className="card space-y-2 p-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-primary">Who gets a payslip</h2>
            <span className="text-xs text-muted">{picked.size} of {doc.slips.length} selected</span>
          </div>
          <label className="relative block">
            <Search className="pointer-events-none absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted" aria-hidden />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search name or ID…" className="input h-9 w-full pl-8" aria-label="Search employees" />
          </label>
          <div className="flex gap-3 text-xs">
            <button type="button" className="font-medium text-[var(--brand-primary)] hover:underline" onClick={() => setPicked((p) => { const n = new Set(p); for (const { s } of shown) n.add(s.lineId); return n; })}>{query ? "Select these" : "Select all"}</button>
            <button type="button" className="font-medium text-[var(--brand-primary)] hover:underline" onClick={() => setPicked((p) => { const n = new Set(p); for (const { s } of shown) n.delete(s.lineId); return n; })}>{query ? "Clear these" : "Select none"}</button>
          </div>
          <ul className="max-h-72 divide-y divide-[var(--border)] overflow-auto rounded-md border border-default" aria-label="Employees">
            {shown.length === 0 && <li className="px-3 py-2 text-sm text-muted">No one matches.</li>}
            {shown.map(({ s }) => (
              <li key={s.lineId} className="flex items-center gap-2 px-3 py-1.5 text-sm">
                <input type="checkbox" checked={picked.has(s.lineId)} onChange={() => toggle(s.lineId)} aria-label={`Include ${s.employee.name}`} />
                <button type="button" className="min-w-0 flex-1 text-left" onClick={() => { setPicked((p) => new Set(p).add(s.lineId)); setViewing(s.lineId); }} title="Preview this payslip">
                  <span className="block truncate text-primary">{s.employee.name}</span>
                  <span className="block text-xs text-muted">{s.employee.idNo}</span>
                </button>
                <button type="button" className="text-xs text-muted hover:underline" onClick={() => { setPicked(new Set([s.lineId])); setViewing(s.lineId); }}>Only</button>
              </li>
            ))}
          </ul>
          {!allShownPicked && picked.size === 0 && <p className="text-xs text-[var(--warning)]">Pick at least one employee to download.</p>}
        </section>

        <section className="card space-y-2 p-4">
          <h2 className="text-sm font-semibold text-primary">Show on payslip</h2>
          <p className="text-xs text-muted">Switch a line off to keep it off the payslip. Its amount is added into <b>Other earnings</b> or <b>Other deductions</b>, so the totals and net pay stay the same.</p>
          <ul className="divide-y divide-[var(--border)]">
            {PAYSLIP_HIDEABLE.map((h) => (
              <li key={h.key}>
                <label className="flex cursor-pointer items-center justify-between gap-3 py-1.5 text-sm text-secondary">
                  <span>{h.label}</span>
                  <input type="checkbox" role="switch" checked={!hidden.includes(h.key)} onChange={() => toggleHidden(h.key)} aria-label={`Show ${h.label}`} />
                </label>
              </li>
            ))}
          </ul>
          <div className="flex flex-wrap items-center gap-2 pt-1 text-xs">
            <button type="button" className="font-semibold text-brand hover:underline disabled:opacity-40 disabled:no-underline" disabled={!hiddenChanged || savingDefault} onClick={saveDefault}>{savingDefault ? "Saving…" : "Use this for every payslip"}</button>
            {!hiddenChanged && hidden.length > 0 && <span className="text-muted">This is the company default.</span>}
            {defaultError && <span role="alert" className="text-[var(--error)]">{defaultError}</span>}
          </div>
        </section>

        <section className="card space-y-3 p-4">
          <h2 className="text-sm font-semibold text-primary">Signature &amp; printing <span className="text-xs font-normal text-muted">(optional)</span></h2>
          <p className="text-xs text-muted">Issued in the name of <strong>{issuer.name}</strong>.</p>
          <label className="block"><span className="mb-1 block text-xs font-medium text-muted">Signatory name</span><input value={signatoryName} onChange={(e) => setSignatoryName(e.target.value)} placeholder="Authorised Signatory" className="input w-full" /></label>
          <label className="block"><span className="mb-1 block text-xs font-medium text-muted">Title</span><input value={signatoryTitle} onChange={(e) => setSignatoryTitle(e.target.value)} placeholder="e.g. General Manager" className="input w-full" /></label>
          <label className={`flex items-start gap-2 text-sm ${issuer.signatureUrl ? "text-secondary" : "text-subtle"}`}>
            <input type="checkbox" checked={showSignature} disabled={!issuer.signatureUrl} onChange={(e) => setShowSignature(e.target.checked)} className="mt-0.5" />
            <span>Add signature image{!issuer.signatureUrl && <span className="block text-xs text-muted">No signature uploaded for {issuer.name}. Add one under {issuer.where}.</span>}</span>
          </label>
          <label className={`flex items-start gap-2 text-sm ${issuer.stampUrl ? "text-secondary" : "text-subtle"}`}>
            <input type="checkbox" checked={showStamp} disabled={!issuer.stampUrl} onChange={(e) => setShowStamp(e.target.checked)} className="mt-0.5" />
            <span>Add company stamp{!issuer.stampUrl && <span className="block text-xs text-muted">No stamp uploaded for {issuer.name}. Add one under {issuer.where}.</span>}</span>
          </label>
          <div className="space-y-2 border-t border-default pt-3 text-sm text-secondary">
            <label className="flex items-start gap-2"><input type="radio" name="paper" checked={!onLetterhead} onChange={() => setOnLetterhead(false)} className="mt-0.5" /><span>Plain paper<span className="block text-xs text-muted">Prints the header (name, address, contact) of {issuer.name}, inside the margins set in Company profile › Letters.</span></span></label>
            <label className="flex items-start gap-2"><input type="radio" name="paper" checked={onLetterhead} onChange={() => setOnLetterhead(true)} className="mt-0.5" /><span>On letterhead<span className="block text-xs text-muted">{issuer.letterheadKind === "image" ? `Uses the uploaded letterhead of ${issuer.name} as the page background.` : issuer.letterheadKind === "pdf" ? `Uses the PDF letterhead of ${issuer.name}. It appears on the downloaded PDF, not in this preview.` : `No letterhead is uploaded for ${issuer.name} (add one under ${issuer.where}). Leaves the header and footer space clear for pre-printed paper.`}</span></span></label>
          </div>
        </section>

        <div className="flex flex-wrap gap-2">
          {picked.size > 0 ? <a className="btn btn-primary" href={pdf} target="_blank" rel="noreferrer"><Download className="h-4 w-4" aria-hidden /> Download PDF ({picked.size})</a> : <button type="button" className="btn btn-primary" disabled><Download className="h-4 w-4" aria-hidden /> Download PDF</button>}
          <PrintButton />
        </div>
      </div>

      <div className="min-w-0">
        {current ? (
          <>
            <div className="mb-2 flex items-center justify-between text-xs font-medium text-muted print:hidden">
              <span>Preview · {current.s.employee.name}</span>
              <span className="inline-flex items-center gap-1">
                <button type="button" className="rounded p-1 hover:bg-surface-hover disabled:opacity-40" disabled={at <= 0} onClick={() => setViewing(chosen[at - 1].s.lineId)} aria-label="Previous payslip"><ChevronLeft className="h-4 w-4" aria-hidden /></button>
                {at + 1} of {chosen.length}
                <button type="button" className="rounded p-1 hover:bg-surface-hover disabled:opacity-40" disabled={at >= chosen.length - 1} onClick={() => setViewing(chosen[at + 1].s.lineId)} aria-label="Next payslip"><ChevronRight className="h-4 w-4" aria-hidden /></button>
              </span>
            </div>
            <PayslipCard doc={doc} i={current.i} paper={{ onLetterhead, letterheadUrl: issuer.letterheadUrl, topMm: issuer.topMm, bottomMm: issuer.bottomMm, margins, signatoryName, signatoryTitle, signatureUrl: showSignature ? issuer.signatureUrl : null, stampUrl: showStamp ? issuer.stampUrl : null }} />
          </>
        ) : <p className="card p-6 text-sm text-muted">Select at least one employee to preview their payslip.</p>}
      </div>
    </div>
  );
}
