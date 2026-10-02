"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { Download, FileText, Loader2, Package } from "lucide-react";
import { m } from "motion/react";
import { Checkbox } from "@/components/ui/Checkbox";
import { Select } from "@/components/ui/Select";
import { DatePicker } from "@/components/ui/DatePicker";
import { ClientLetterPaper } from "@/components/LetterPreview";
import { useLetterheadImage } from "@/components/useLetterheadImage";
import { cn } from "@/lib/cn";
import { SPRING } from "@/lib/motion";
import { PACK_SECTIONS } from "@/lib/mobilisationPack";
import { substituteInHtml } from "@/lib/letterHtml";
import { NOC_DISPLAY_FIELDS, DEFAULT_NOC_DISPLAY_FIELDS } from "@/lib/nocDisplayFields";
import {
  DEFAULT_LETTER_COLUMNS,
  LETTER_TABLE_COLUMNS,
  columnsFromNocFields,
  formatLetterDate,
  letterCellValue,
  type LetterWorker,
} from "@/lib/letterLayout";
import { issueNocAction } from "@/app/(app)/operations/nocs/actions";

type Template = { id: string; name: string; title: string; html: string };
type Noc = { id: string; docNo: number; status: string; createdAt: string; workers: number };
type Worker = {
  id: string; name: string; employeeIdNo: string; trade: string | null; nationality: string | null; passportNumber: string | null; emiratesId: string | null; visaStatus: string | null;
  supplierId: string | null; sponsorSupplierId: string | null; supplierName: string | null;
};
type Sponsor = { name: string; hasLetterhead: boolean; contactPerson: string | null; contactPhone: string | null; contactEmail: string | null; topMm: number; bottomMm: number };
type Company = {
  name: string; letterheadUrl: string | null; topMm: number; bottomMm: number; signatoryName: string; signatoryTitle: string;
  signatureUrl: string | null; stampUrl: string | null; phone: string | null; email: string | null;
};
type Demand = { id: string; requestNo: number; clientName: string; clientAddress: string | null; projectName: string; branchName: string };

const TABS = [
  { key: "noc", label: "NOC" },
  { key: "undertaking", label: "Undertaking" },
  { key: "profile", label: "Employee profile pack" },
] as const;

/**
 * The documents a mobilisation produces, one tab each.
 *
 * NOC and Undertaking are letters, built the way every other letter on the
 * platform is: choose the wording and the workers on the left, see the A4 sheet
 * on the right with the real letterhead behind it, then issue it. The wording
 * itself lives in Letter Templates.
 */
export function DocumentTabs(props: {
  demand: Demand;
  workers: Worker[];
  nocTemplates: Template[];
  undertakingTemplates: Template[];
  nocs: Noc[];
  sponsors: Record<string, Sponsor>;
  company: Company;
}) {
  const [tab, setTab] = useState<(typeof TABS)[number]["key"]>("noc");
  return (
    <div className="space-y-4">
      <div className="flex gap-1 border-b border-default">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={cn("relative px-3 py-2 text-sm font-medium transition-colors", tab === t.key ? "text-[var(--brand-primary)]" : "text-muted hover:text-primary")}
          >
            {t.label}
            {tab === t.key && <m.span layoutId="document-tabs-underline" transition={SPRING} className="absolute inset-x-0 -bottom-px h-0.5 rounded-full bg-[var(--brand-primary)]" aria-hidden />}
          </button>
        ))}
      </div>

      {tab === "noc" && <LetterBuilder kind="noc" {...props} templates={props.nocTemplates} />}
      {tab === "undertaking" && <LetterBuilder kind="undertaking" {...props} templates={props.undertakingTemplates} />}
      {tab === "profile" && <ProfilePack demand={props.demand} workers={props.workers} />}
    </div>
  );
}

const toLetterWorker = (w: Worker): LetterWorker => ({
  id: w.id, name: w.name, employeeIdNo: w.employeeIdNo, trade: w.trade, nationality: w.nationality, passportNumber: w.passportNumber,
  emiratesId: w.emiratesId, visaStatus: w.visaStatus, supplierId: w.supplierId, supplierName: w.supplierName, sponsorSupplierId: w.sponsorSupplierId,
});

function LetterBuilder({
  kind, demand, workers, templates, nocs, sponsors, company,
}: {
  kind: "noc" | "undertaking";
  demand: Demand;
  workers: Worker[];
  templates: Template[];
  nocs: Noc[];
  sponsors: Record<string, Sponsor>;
  company: Company;
}) {
  const isNoc = kind === "noc";
  const [templateId, setTemplateId] = useState(templates[0]?.id ?? "");
  const [chosen, setChosen] = useState<Set<string>>(() => new Set(workers.map((w) => w.id)));
  const [onLetterhead, setOnLetterhead] = useState(true);
  const [mobilizeDate, setMobilizeDate] = useState("");
  const [remarks, setRemarks] = useState("");
  const [fields, setFields] = useState<Set<string>>(new Set(DEFAULT_NOC_DISPLAY_FIELDS));
  const [signatoryName, setSignatoryName] = useState(company.signatoryName);
  const [signatoryTitle, setSignatoryTitle] = useState(company.signatoryTitle);
  const [showSignature, setShowSignature] = useState(false);
  const [showStamp, setShowStamp] = useState(false);
  const [issuing, startIssue] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const template = templates.find((t) => t.id === templateId);
  const picked = workers.filter((w) => chosen.has(w.id));
  const columns = useMemo(() => {
    const keys = isNoc ? columnsFromNocFields([...fields]) : DEFAULT_LETTER_COLUMNS;
    return LETTER_TABLE_COLUMNS.filter((c) => keys.includes(c.key)).map((c) => ({ key: c.key as string, label: c.label as string, width: c.width as number }));
  }, [fields, isNoc]);

  // One letter per sponsor for a NOC; one from our own company for an undertaking.
  const groups = useMemo(() => {
    if (!isNoc) return [{ id: null as string | null, issuer: company.name, workers: picked }];
    const by = new Map<string, Worker[]>();
    for (const w of picked) {
      const key = w.sponsorSupplierId ?? w.supplierId ?? "";
      by.set(key, [...(by.get(key) ?? []), w]);
    }
    return [...by.entries()].map(([id, ws]) => ({ id: id || null, issuer: (id && sponsors[id]?.name) || ws[0]?.supplierName || "Workers with no company set", workers: ws }));
  }, [picked, isNoc, company.name, sponsors]);

  const missing = isNoc ? groups.filter((g) => !g.id || !sponsors[g.id]?.hasLetterhead).map((g) => g.issuer) : company.letterheadUrl ? [] : [company.name];

  function toggle(id: string) {
    setChosen((p) => { const n = new Set(p); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  }

  const undertakingHref = (() => {
    const q = new URLSearchParams({ templateId });
    if (onLetterhead) q.set("letterhead", "1");
    if (chosen.size !== workers.length) for (const id of chosen) q.append("employee", id);
    if (signatoryName.trim()) q.set("signatoryName", signatoryName.trim());
    if (signatoryTitle.trim()) q.set("signatoryTitle", signatoryTitle.trim());
    if (showSignature) q.set("signature", "1");
    if (showStamp) q.set("stamp", "1");
    return `/api/demand-requests/${demand.id}/undertaking?${q.toString()}`;
  })();

  function issueNoc() {
    setError(null);
    const fd = new FormData();
    fd.set("demandRequestId", demand.id);
    fd.set("templateId", templateId);
    for (const id of chosen) fd.append("employeeId", id);
    fd.set("displayFields", [...fields].join(","));
    fd.set("mobilizeDate", mobilizeDate);
    fd.set("remarks", remarks);
    startIssue(async () => {
      const res = await issueNocAction(fd);
      if (res.error) setError(res.error);
      else if (res.id) window.open(`/api/nocs/${res.id}${onLetterhead ? "?letterhead=1" : ""}`, "_blank");
    });
  }

  if (templates.length === 0) {
    return (
      <div className="card p-8 text-center text-sm text-muted">
        No <span className="font-medium">{isNoc ? "No Objection Letter" : "Undertaking Letter"}</span> template yet.{" "}
        <Link href={`/letter-templates?tab=${isNoc ? "noc" : "undertaking"}`} className="underline">Add one in Letter Templates</Link>.
      </div>
    );
  }
  if (workers.length === 0) {
    return <div className="card p-8 text-center text-sm text-muted">Nobody is mobilised on this demand yet. Mobilise workers first.</div>;
  }

  const ready = !!template && picked.length > 0;

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,24rem)_minmax(0,1fr)]">
      <div className="space-y-4 self-start">
        <div className="card space-y-4 p-4">
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-muted">Letter</span>
            <Select value={templateId} onChange={setTemplateId} searchable={false} options={templates.map((t) => ({ value: t.id, label: t.name }))} />
          </label>

          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <span className="text-xs font-medium text-muted">Workers ({chosen.size} of {workers.length})</span>
              <button type="button" className="text-xs font-medium text-[var(--brand-primary)] hover:underline" onClick={() => setChosen(chosen.size === workers.length ? new Set() : new Set(workers.map((w) => w.id)))}>
                {chosen.size === workers.length ? "Deselect all" : "Select all"}
              </button>
            </div>
            <ul className="max-h-56 divide-y divide-[var(--border)] overflow-y-auto rounded-card border border-default">
              {workers.map((w) => (
                <li key={w.id} className="flex items-center gap-2.5 px-3 py-1.5">
                  <Checkbox checked={chosen.has(w.id)} onCheckedChange={() => toggle(w.id)} />
                  <span className="min-w-0 flex-1 truncate text-sm text-primary">
                    {w.name}
                    <span className="tabular ml-2 text-xs text-subtle">{w.employeeIdNo}</span>
                  </span>
                  <span className="text-xs text-muted">{w.trade || "—"}</span>
                </li>
              ))}
            </ul>
          </div>

          {isNoc && (
            <>
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-muted">Mobilize date</span>
                <DatePicker value={mobilizeDate} onChange={setMobilizeDate} className="w-full" />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-muted">Remarks (kept on the record, not printed)</span>
                <input value={remarks} onChange={(e) => setRemarks(e.target.value)} className="input w-full" />
              </label>
              <details className="rounded-card border border-default">
                <summary className="cursor-pointer px-3 py-2 text-sm font-medium text-secondary">Table columns</summary>
                <div className="grid grid-cols-2 gap-1 border-t border-default p-2">
                  {NOC_DISPLAY_FIELDS.map((f) => (
                    <label key={f.key} className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1 text-sm hover:bg-surface-hover">
                      <input type="checkbox" checked={fields.has(f.key)} onChange={() => setFields((p) => { const n = new Set(p); if (n.has(f.key)) n.delete(f.key); else n.add(f.key); return n; })} />
                      {f.label}
                    </label>
                  ))}
                </div>
              </details>
            </>
          )}
        </div>

        <div className="card space-y-3 p-4">
          <p className="text-xs font-semibold tracking-wide text-muted uppercase">Printing</p>
          <label className="flex items-start gap-2 text-sm">
            <input type="radio" name={`paper-${kind}`} checked={!onLetterhead} onChange={() => setOnLetterhead(false)} className="mt-1" />
            <span><span className="font-medium text-primary">Plain paper</span><span className="block text-xs text-muted">No letterhead drawn. For feeding pre-printed paper through the printer.</span></span>
          </label>
          <label className="flex items-start gap-2 text-sm">
            <input type="radio" name={`paper-${kind}`} checked={onLetterhead} onChange={() => setOnLetterhead(true)} className="mt-1" />
            <span>
              <span className="font-medium text-primary">{isNoc ? "On the sponsor's letterhead" : "On the company letterhead"}</span>
              <span className="block text-xs text-muted">
                {isNoc ? `One letter per sponsor (${groups.length}), each on that sponsor's letterhead.` : `One letter from ${company.name}, on the letterhead in Company profile.`}
              </span>
            </span>
          </label>
          {onLetterhead && missing.length > 0 && (
            <p className="rounded-card border border-[var(--warning-border)] bg-[var(--warning-soft)] px-3 py-2 text-xs text-[var(--warning)]">
              No letterhead on file for {missing.join(", ")}, so {missing.length === 1 && !isNoc ? "this letter" : "that letter"} prints plain.{" "}
              {isNoc ? "Upload one on the sponsor supplier's Documents tab." : "Upload one in Settings → Company profile → Letters."}
            </p>
          )}

          {!isNoc && (
            <div className="space-y-3 border-t border-default pt-3">
              <p className="text-xs font-semibold tracking-wide text-muted uppercase">Signature block (optional)</p>
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-muted">Signed by</span>
                <input value={signatoryName} onChange={(e) => setSignatoryName(e.target.value)} placeholder="Authorised Signatory" className="input w-full" />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-muted">Title</span>
                <input value={signatoryTitle} onChange={(e) => setSignatoryTitle(e.target.value)} placeholder="e.g. General Manager" className="input w-full" />
              </label>
              <label className={cn("flex items-start gap-2 text-sm", company.signatureUrl ? "text-secondary" : "text-subtle")}>
                <input type="checkbox" disabled={!company.signatureUrl} checked={showSignature} onChange={(e) => setShowSignature(e.target.checked)} className="mt-0.5" />
                <span>Add signature image{!company.signatureUrl && <span className="block text-xs text-muted">Upload one under Settings → Company profile → Letters.</span>}</span>
              </label>
              <label className={cn("flex items-start gap-2 text-sm", company.stampUrl ? "text-secondary" : "text-subtle")}>
                <input type="checkbox" disabled={!company.stampUrl} checked={showStamp} onChange={(e) => setShowStamp(e.target.checked)} className="mt-0.5" />
                <span>Add company stamp{!company.stampUrl && <span className="block text-xs text-muted">Upload one under Settings → Company profile → Letters.</span>}</span>
              </label>
            </div>
          )}

          {error && <p role="alert" className="text-sm text-[var(--error)]">{error}</p>}
          {isNoc ? (
            <button type="button" className="btn btn-primary w-full" disabled={!ready || issuing} onClick={issueNoc}>
              {issuing ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <FileText className="h-4 w-4" aria-hidden />}
              {issuing ? "Issuing…" : "Issue NOC & open PDF"}
            </button>
          ) : (
            <a href={undertakingHref} target="_blank" rel="noreferrer" aria-disabled={!ready} className={cn("btn btn-primary w-full", !ready && "pointer-events-none opacity-50")}>
              <Download className="h-4 w-4" aria-hidden /> Download PDF
            </a>
          )}
        </div>

        {isNoc && nocs.length > 0 && (
          <div className="card p-4">
            <p className="mb-2 text-xs font-semibold tracking-wide text-muted uppercase">Issued for this demand</p>
            <ul className="divide-y divide-[var(--border)]">
              {nocs.map((n) => (
                <li key={n.id} className="flex items-center justify-between gap-2 py-2">
                  <Link href={`/operations/nocs/${n.id}`} className="min-w-0 text-sm text-primary hover:underline">
                    NOC-{n.docNo}
                    <span className="ml-2 text-xs text-subtle">{n.workers} worker{n.workers === 1 ? "" : "s"} · {formatLetterDate(new Date(n.createdAt))}</span>
                  </Link>
                  <a href={`/api/nocs/${n.id}${onLetterhead ? "?letterhead=1" : ""}`} className="inline-flex items-center gap-1 text-xs font-medium text-[var(--brand-primary)] hover:underline">
                    <Download className="h-3.5 w-3.5" aria-hidden /> PDF
                  </a>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <div className="min-w-0">
        <p className="mb-2 text-xs font-medium text-muted">Preview{isNoc && groups.length > 1 ? ` · ${groups.length} letters` : ""}</p>
        <div className="space-y-6 rounded-lg bg-surface-sunken p-4">
          {!template || picked.length === 0 ? (
            <p className="py-16 text-center text-sm text-muted">{picked.length === 0 ? "Tick at least one worker to see the letter." : "Choose a letter."}</p>
          ) : (
            groups.map((g, i) => (
              <SheetFor
                key={g.id ?? `none-${i}`}
                label={groups.length > 1 ? `Letter ${i + 1} of ${groups.length} · ${g.issuer}` : null}
                demand={demand}
                template={template}
                kind={kind}
                issuerName={g.issuer}
                workers={g.workers}
                columns={columns}
                onLetterhead={onLetterhead}
                letterheadUrl={isNoc ? (g.id && sponsors[g.id]?.hasLetterhead ? `/api/suppliers/${g.id}/letterhead` : null) : company.letterheadUrl}
                topMm={isNoc ? (g.id ? sponsors[g.id]?.topMm : undefined) ?? 65 : company.topMm}
                bottomMm={isNoc ? (g.id ? sponsors[g.id]?.bottomMm : undefined) ?? 35 : company.bottomMm}
                signing={isNoc ? { name: g.id ? sponsors[g.id]?.contactPerson ?? null : null, title: null, phone: g.id ? sponsors[g.id]?.contactPhone ?? null : null, email: g.id ? sponsors[g.id]?.contactEmail ?? null : null, signatureUrl: null, stampUrl: null } : { name: signatoryName.trim() || null, title: signatoryTitle.trim() || null, phone: company.phone, email: company.email, signatureUrl: showSignature ? company.signatureUrl : null, stampUrl: showStamp ? company.stampUrl : null }}
                mobilizeDate={mobilizeDate}
              />
            ))
          )}
        </div>
        {isNoc && <p className="mt-2 text-xs text-muted">Wording comes from the template. Page breaks in the PDF can differ slightly from this preview.</p>}
      </div>
    </div>
  );
}

function SheetFor({
  label, demand, template, kind, issuerName, workers, columns, onLetterhead, letterheadUrl, topMm, bottomMm, signing, mobilizeDate,
}: {
  label: string | null;
  demand: Demand;
  template: Template;
  kind: "noc" | "undertaking";
  issuerName: string;
  workers: Worker[];
  columns: { key: string; label: string; width: number }[];
  onLetterhead: boolean;
  letterheadUrl: string | null;
  topMm: number;
  bottomMm: number;
  signing: { name: string | null; title: string | null; phone: string | null; email: string | null; signatureUrl: string | null; stampUrl: string | null };
  mobilizeDate: string;
}) {
  const src = useLetterheadImage(onLetterhead ? letterheadUrl : null);
  const now = new Date();
  const body = substituteInHtml(template.html, {
    CLIENTNAME: demand.clientName,
    CLIENTADDRESS: demand.clientAddress ?? "",
    PROJECTNAME: demand.projectName,
    COMPANYNAME: issuerName,
    SPONSORSHIPCOMPANYNAME: issuerName,
    BRANCHNAME: demand.branchName,
    DOCNO: kind === "undertaking" ? String(demand.requestNo) : "••",
    MOBILIZEDATE: mobilizeDate ? formatLetterDate(new Date(mobilizeDate)) : "",
    DATE: formatLetterDate(now),
    WORKERCOUNT: String(workers.length),
  });
  const rows = workers.map((w, i) => columns.map((c) => letterCellValue(c.key, toLetterWorker(w), i, w.supplierName ?? "")));
  return (
    <div>
      {label && <p className="mb-2 text-xs font-semibold text-secondary">{label}</p>}
      <ClientLetterPaper
        date={formatLetterDate(now)}
        clientName={demand.clientName}
        clientAddress={demand.clientAddress}
        projectName={demand.projectName}
        title={template.title}
        bodyHtml={body}
        columns={columns}
        rows={rows}
        issuerName={issuerName}
        signatoryName={signing.name}
        signatoryTitle={signing.title}
        signatoryPhone={signing.phone}
        signatoryEmail={signing.email}
        signatureUrl={signing.signatureUrl}
        stampUrl={signing.stampUrl}
        onLetterhead={onLetterhead}
        letterheadSrc={src}
        topMm={topMm}
        bottomMm={bottomMm}
      />
    </div>
  );
}

function ProfilePack({ demand, workers }: { demand: Demand; workers: Worker[] }) {
  const [sections, setSections] = useState<Set<string>>(() => new Set(PACK_SECTIONS.map((s) => s.key)));
  // Everyone mobilised is included by default; deselect to leave someone out
  // (a worker whose papers aren't ready shouldn't hold up the rest of the pack).
  const [chosen, setChosen] = useState<Set<string>>(() => new Set(workers.map((w) => w.id)));
  const toggleSection = (key: string) => setSections((p) => { const n = new Set(p); if (n.has(key)) n.delete(key); else n.add(key); return n; });
  const toggleWorker = (id: string) => setChosen((p) => { const n = new Set(p); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  const href = `/api/demand-requests/${demand.id}/pack?${[
    ...[...sections].map((s) => `section=${encodeURIComponent(s)}`),
    ...[...chosen].map((id) => `employee=${encodeURIComponent(id)}`),
  ].join("&")}`;
  const disabled = sections.size === 0 || chosen.size === 0;

  if (workers.length === 0) {
    return <div className="card p-8 text-center text-sm text-muted">Nobody is mobilised on this demand yet. Mobilise workers first.</div>;
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="card p-4">
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-xs font-semibold tracking-wide text-muted uppercase">Workers ({chosen.size} of {workers.length})</h3>
          <button type="button" className="text-xs font-medium text-[var(--brand-primary)] hover:underline" onClick={() => setChosen(chosen.size === workers.length ? new Set() : new Set(workers.map((w) => w.id)))}>
            {chosen.size === workers.length ? "Deselect all" : "Select all"}
          </button>
        </div>
        <ul className="max-h-80 divide-y divide-[var(--border)] overflow-y-auto rounded-card border border-default">
          {workers.map((w) => (
            <li key={w.id} className="flex items-center gap-2.5 px-3 py-2">
              <Checkbox checked={chosen.has(w.id)} onCheckedChange={() => toggleWorker(w.id)} />
              <span className="min-w-0 flex-1 truncate text-sm text-primary">{w.name}<span className="tabular ml-2 text-xs text-subtle">{w.employeeIdNo}</span></span>
              <span className="text-xs text-muted">{w.trade || "No trade"}</span>
            </li>
          ))}
        </ul>
      </div>
      <div className="card space-y-4 self-start p-4">
        <div className="flex items-start gap-2.5">
          <Package className="mt-0.5 h-4 w-4 shrink-0 text-[var(--brand-primary)]" aria-hidden />
          <p className="text-sm text-secondary">One zip, with a folder per worker. Anything not on file is listed in the manifest instead of being silently skipped.</p>
        </div>
        <ul className="space-y-2">
          {PACK_SECTIONS.map((section) => (
            <li key={section.key} className="flex items-start gap-2.5">
              <Checkbox checked={sections.has(section.key)} onCheckedChange={() => toggleSection(section.key)} />
              <span className="min-w-0">
                <span className="block text-sm text-primary">{section.label}</span>
                {section.hint && <span className="block text-xs text-subtle">{section.hint}</span>}
              </span>
            </li>
          ))}
        </ul>
        <a href={href} aria-disabled={disabled} className={cn("btn btn-primary w-full", disabled && "pointer-events-none opacity-50")}>
          <Download className="h-3.5 w-3.5" aria-hidden />
          Download {sections.size} document{sections.size === 1 ? "" : "s"} for {chosen.size} worker{chosen.size === 1 ? "" : "s"}
        </a>
        <p className="text-xs text-muted">mobilisation-{demand.requestNo}.zip</p>
      </div>
    </div>
  );
}
